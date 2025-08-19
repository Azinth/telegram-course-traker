import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  migrationService,
  MigrationStatus,
  MigrationResult,
} from "@/lib/migrations";
import { z } from "zod";
import { headers } from "next/headers";
import {
  checkRateLimit,
  createRateLimitIdentifier,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  migrationExecutionSchema,
  migrationStatusQuerySchema,
  validateRequestSize,
  validateContentType,
  validateUserAgent,
  validateIPAddress,
  sanitizeString,
} from "@/lib/validation/migration-schemas";
import { validateCSRFHeaders, logCSRFAttempt } from "@/lib/csrf-protection";

// Response interfaces
interface GetMigrationsResponse {
  status: MigrationStatus;
  message: string;
}

interface PostMigrationsResponse {
  results: MigrationResult[];
  message: string;
  success: boolean;
}

interface ErrorResponse {
  error: string;
  details?: string;
  timestamp: string;
  requestId?: string;
}

// Security logging function
async function logSecurityEvent(
  event: string,
  email: string | null,
  ip: string | null,
  userAgent: string | null,
  details?: string,
) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${event}`, {
    email,
    ip,
    userAgent,
    details,
  });

  // In production, you might want to store this in a dedicated security log table
  // or send to a security monitoring service
}

// Helper function to get user details from session
async function getUserDetails(
  email: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const { query } = await import("@/lib/database");
    const res = await query("SELECT id, name FROM users WHERE email=$1", [
      email,
    ]);
    return res.rows[0] ? { id: res.rows[0].id, name: res.rows[0].name } : null;
  } catch (error) {
    console.error("Error fetching user details:", error);
    return null;
  }
}

// Enhanced authorization function with admin check
// For now, we'll use a simple admin email list, but this should be replaced
// with a proper role-based system in production
async function isAuthorized(email: string): Promise<boolean> {
  try {
    // Check if user exists and is active
    const userDetails = await getUserDetails(email);
    if (!userDetails) {
      return false;
    }

    // For now, we'll use environment variable for admin emails
    // In production, implement proper role-based access control
    const adminEmails =
      process.env.MIGRATION_ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];

    // If no admin emails configured, allow any authenticated user (development mode)
    if (adminEmails.length === 0) {
      console.warn(
        "No MIGRATION_ADMIN_EMAILS configured. Allowing any authenticated user to access migrations.",
      );
      return true;
    }

    return adminEmails.includes(email);
  } catch (error) {
    console.error("Error checking authorization:", error);
    return false;
  }
}

// Helper function to extract client IP and User-Agent
function getClientInfo() {
  const headersList = headers();
  const ip =
    headersList.get("x-forwarded-for") ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  return { ip, userAgent };
}

// GET /api/migrations - Get migration status
export async function GET(request: Request) {
  const { ip, userAgent } = getClientInfo();

  try {
    // Security validations
    if (!validateUserAgent(userAgent)) {
      await logSecurityEvent(
        "INVALID_USER_AGENT",
        null,
        ip,
        userAgent,
        "GET /api/migrations - Invalid User-Agent",
      );

      return NextResponse.json(
        {
          error: "bad_request",
          details: "Invalid User-Agent header",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 400 },
      );
    }

    if (!validateIPAddress(ip)) {
      await logSecurityEvent(
        "INVALID_IP_ADDRESS",
        null,
        ip,
        userAgent,
        "GET /api/migrations - Invalid IP address",
      );

      return NextResponse.json(
        {
          error: "bad_request",
          details: "Invalid request source",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 400 },
      );
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      await logSecurityEvent(
        "UNAUTHORIZED_MIGRATION_ACCESS_ATTEMPT",
        null,
        ip,
        userAgent,
        "GET /api/migrations - No session",
      );

      return NextResponse.json(
        {
          error: "unauthorized",
          details: "Authentication required to access migration status",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 401 },
      );
    }

    // Rate limiting
    const rateLimitId = createRateLimitIdentifier(ip, session.user.email);
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMITS.MIGRATION_GET);

    if (!rateLimit.allowed) {
      await logSecurityEvent(
        "RATE_LIMIT_EXCEEDED",
        session.user.email,
        ip,
        userAgent,
        `GET /api/migrations - Rate limit exceeded, retry after ${rateLimit.retryAfter}s`,
      );

      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          details: "Too many requests. Please try again later.",
          timestamp: new Date().toISOString(),
          retryAfter: rateLimit.retryAfter,
        } as ErrorResponse & { retryAfter?: number },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit":
              RATE_LIMITS.MIGRATION_GET.maxRequests.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
            "Retry-After": rateLimit.retryAfter?.toString() || "60",
          },
        },
      );
    }

    // Validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    try {
      migrationStatusQuerySchema.parse(queryParams);
    } catch (validationError) {
      await logSecurityEvent(
        "INVALID_QUERY_PARAMETERS",
        session.user.email,
        ip,
        userAgent,
        `GET /api/migrations - Invalid query parameters: ${validationError instanceof Error ? validationError.message : "Unknown error"}`,
      );

      return NextResponse.json(
        {
          error: "bad_request",
          details: "Invalid query parameters",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 400 },
      );
    }

    // Check authorization
    const authorized = await isAuthorized(session.user.email);
    if (!authorized) {
      await logSecurityEvent(
        "FORBIDDEN_MIGRATION_ACCESS_ATTEMPT",
        session.user.email,
        ip,
        userAgent,
        "GET /api/migrations - Insufficient permissions",
      );

      return NextResponse.json(
        {
          error: "forbidden",
          details: "Insufficient permissions to access migration status",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 403 },
      );
    }

    // Log successful access
    await logSecurityEvent(
      "MIGRATION_STATUS_ACCESSED",
      session.user.email,
      ip,
      userAgent,
      "GET /api/migrations - Success",
    );

    // Get migration status
    const status = await migrationService.getMigrationStatus();

    let message: string;
    if (status.isUpToDate) {
      message = "Database is up to date. No pending migrations.";
    } else {
      message = `${status.pendingMigrations.length} pending migration(s) found.`;
    }

    const response: GetMigrationsResponse = {
      status,
      message,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error getting migration status:", error);

    // Log security event for server errors
    const session = await getServerSession(authOptions);
    await logSecurityEvent(
      "MIGRATION_STATUS_ERROR",
      session?.user?.email || null,
      ip,
      userAgent,
      `GET /api/migrations - Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );

    const errorResponse: ErrorResponse = {
      error: "internal_server_error",
      details:
        error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST /api/migrations - Execute pending migrations
export async function POST(req: Request) {
  const { ip, userAgent } = getClientInfo();

  try {
    // Security validations
    if (!validateUserAgent(userAgent)) {
      await logSecurityEvent(
        "INVALID_USER_AGENT",
        null,
        ip,
        userAgent,
        "POST /api/migrations - Invalid User-Agent",
      );

      return NextResponse.json(
        {
          error: "bad_request",
          details: "Invalid User-Agent header",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 400 },
      );
    }

    if (!validateIPAddress(ip)) {
      await logSecurityEvent(
        "INVALID_IP_ADDRESS",
        null,
        ip,
        userAgent,
        "POST /api/migrations - Invalid IP address",
      );

      return NextResponse.json(
        {
          error: "bad_request",
          details: "Invalid request source",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 400 },
      );
    }

    // Validate request size and content type
    if (!validateRequestSize(req)) {
      await logSecurityEvent(
        "REQUEST_TOO_LARGE",
        null,
        ip,
        userAgent,
        "POST /api/migrations - Request body too large",
      );

      return NextResponse.json(
        {
          error: "payload_too_large",
          details: "Request body too large",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 413 },
      );
    }

    if (!validateContentType(req)) {
      await logSecurityEvent(
        "INVALID_CONTENT_TYPE",
        null,
        ip,
        userAgent,
        "POST /api/migrations - Invalid content type",
      );

      return NextResponse.json(
        {
          error: "unsupported_media_type",
          details: "Content-Type must be application/json",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 415 },
      );
    }

    // CSRF protection for POST requests
    const csrfValid = validateCSRFHeaders();
    logCSRFAttempt(csrfValid, ip, userAgent);

    if (!csrfValid) {
      await logSecurityEvent(
        "CSRF_VALIDATION_FAILED",
        null,
        ip,
        userAgent,
        "POST /api/migrations - CSRF validation failed",
      );

      return NextResponse.json(
        {
          error: "forbidden",
          details: "CSRF validation failed. Include proper headers.",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 403 },
      );
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      await logSecurityEvent(
        "UNAUTHORIZED_MIGRATION_EXECUTION_ATTEMPT",
        null,
        ip,
        userAgent,
        "POST /api/migrations - No session",
      );

      return NextResponse.json(
        {
          error: "unauthorized",
          details: "Authentication required to execute migrations",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 401 },
      );
    }

    // Rate limiting (more restrictive for POST)
    const rateLimitId = createRateLimitIdentifier(ip, session.user.email);
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMITS.MIGRATION_POST);

    if (!rateLimit.allowed) {
      await logSecurityEvent(
        "RATE_LIMIT_EXCEEDED",
        session.user.email,
        ip,
        userAgent,
        `POST /api/migrations - Rate limit exceeded, retry after ${rateLimit.retryAfter}s`,
      );

      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          details: "Too many migration requests. Please try again later.",
          timestamp: new Date().toISOString(),
          retryAfter: rateLimit.retryAfter,
        } as ErrorResponse & { retryAfter?: number },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit":
              RATE_LIMITS.MIGRATION_POST.maxRequests.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimit.resetTime).toISOString(),
            "Retry-After": rateLimit.retryAfter?.toString() || "60",
          },
        },
      );
    }

    // Check authorization
    const authorized = await isAuthorized(session.user.email);
    if (!authorized) {
      await logSecurityEvent(
        "FORBIDDEN_MIGRATION_EXECUTION_ATTEMPT",
        session.user.email,
        ip,
        userAgent,
        "POST /api/migrations - Insufficient permissions",
      );

      return NextResponse.json(
        {
          error: "forbidden",
          details: "Insufficient permissions to execute migrations",
          timestamp: new Date().toISOString(),
        } as ErrorResponse,
        { status: 403 },
      );
    }

    // Log migration execution attempt
    await logSecurityEvent(
      "MIGRATION_EXECUTION_STARTED",
      session.user.email,
      ip,
      userAgent,
      "POST /api/migrations - Starting migration execution",
    );

    // Parse and validate request body
    let requestOptions = {};
    try {
      const body = await req.text();
      if (body.trim()) {
        const parsedBody = JSON.parse(body);

        // Validate against schema
        requestOptions = migrationExecutionSchema.parse(parsedBody);

        // Additional sanitization
        if (requestOptions && typeof requestOptions === "object") {
          Object.keys(requestOptions).forEach((key) => {
            const value = (requestOptions as any)[key];
            if (typeof value === "string") {
              (requestOptions as any)[key] = sanitizeString(value);
            }
          });
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        // JSON parsing error
        await logSecurityEvent(
          "INVALID_REQUEST_BODY",
          session.user.email,
          ip,
          userAgent,
          `POST /api/migrations - Invalid JSON: ${error.message}`,
        );

        return NextResponse.json(
          {
            error: "bad_request",
            details: "Invalid JSON in request body",
            timestamp: new Date().toISOString(),
          } as ErrorResponse,
          { status: 400 },
        );
      } else {
        // Validation error
        await logSecurityEvent(
          "INVALID_REQUEST_PARAMETERS",
          session.user.email,
          ip,
          userAgent,
          `POST /api/migrations - Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );

        return NextResponse.json(
          {
            error: "bad_request",
            details: "Invalid request parameters",
            timestamp: new Date().toISOString(),
          } as ErrorResponse,
          { status: 400 },
        );
      }
    }

    const validatedOptions = requestOptions;

    // Execute migrations
    const results = await migrationService.runMigrations(validatedOptions);

    // Determine success based on results
    const success = results.every((result) => result.success);
    const executedCount = results.filter((result) => result.success).length;
    const failedCount = results.filter((result) => !result.success).length;

    let message: string;
    if (results.length === 0) {
      message = "No pending migrations to execute.";
    } else if (success) {
      message = `Successfully executed ${executedCount} migration(s).`;
    } else {
      message = `Migration execution completed with ${executedCount} success(es) and ${failedCount} failure(s).`;
    }

    // Log migration execution result
    await logSecurityEvent(
      success
        ? "MIGRATION_EXECUTION_SUCCESS"
        : "MIGRATION_EXECUTION_PARTIAL_FAILURE",
      session.user.email,
      ip,
      userAgent,
      `POST /api/migrations - ${message}`,
    );

    const response: PostMigrationsResponse = {
      results,
      message,
      success,
    };

    // Return appropriate status code
    const statusCode = success ? 200 : 500;
    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error("Error executing migrations:", error);

    // Log security event for server errors
    const session = await getServerSession(authOptions);
    await logSecurityEvent(
      "MIGRATION_EXECUTION_ERROR",
      session?.user?.email || null,
      ip,
      userAgent,
      `POST /api/migrations - Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );

    const errorResponse: ErrorResponse = {
      error: "internal_server_error",
      details:
        error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
