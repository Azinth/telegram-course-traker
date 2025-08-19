/**
 * Validation schemas for migration API endpoints
 */

import { z } from "zod";

/**
 * Schema for POST /api/migrations request body
 */
export const migrationExecutionSchema = z.object({
  // Optional timeout for migration execution (1 second to 10 minutes)
  timeout: z
    .number()
    .int()
    .min(1000, "Timeout must be at least 1 second")
    .max(600000, "Timeout cannot exceed 10 minutes")
    .optional(),

  // Optional limit on number of migrations to run
  count: z
    .number()
    .int()
    .min(1, "Count must be at least 1")
    .max(50, "Count cannot exceed 50 migrations")
    .optional(),

  // Optional dry run flag (for future implementation)
  dryRun: z.boolean().optional(),

  // Optional force flag (for future implementation of rollbacks)
  force: z.boolean().optional(),
});

/**
 * Schema for query parameters on GET /api/migrations
 */
export const migrationStatusQuerySchema = z.object({
  // Optional format parameter
  format: z.enum(["json", "summary"]).optional().default("json"),

  // Optional include parameter to include additional details
  include: z.array(z.enum(["timestamps", "details", "errors"])).optional(),
});

/**
 * Schema for validating request headers
 */
export const requestHeadersSchema = z.object({
  "content-type": z
    .string()
    .refine(
      (val) => !val || val.includes("application/json"),
      "Content-Type must be application/json for POST requests",
    )
    .optional(),

  "user-agent": z
    .string()
    .min(1, "User-Agent header is required")
    .max(500, "User-Agent header too long"),

  accept: z.string().optional(),
});

/**
 * Schema for request body size validation
 */
export const requestBodySchema = z
  .string()
  .max(1024, "Request body too large") // 1KB limit
  .optional();

/**
 * Sanitization functions
 */
export function sanitizeString(input: string): string {
  // Remove potentially dangerous characters
  return (
    input
      .replace(/[<>"'&]/g, "") // Remove HTML/XML characters
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f-\x9f]/g, "") // Remove control characters
      .trim()
      .substring(0, 1000)
  ); // Limit length
}

export function sanitizeNumber(input: number): number {
  // Ensure number is finite and within reasonable bounds
  if (!Number.isFinite(input)) {
    throw new Error("Invalid number");
  }
  return Math.floor(input); // Ensure integer
}

/**
 * Validation helper functions
 */
export function validateRequestSize(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    return size <= 1024; // 1KB limit
  }
  return true; // Allow if no content-length header
}

export function validateContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) return true; // Allow empty content type for GET requests
  return contentType.includes("application/json");
}

/**
 * Security validation functions
 */
export function validateUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /script/i,
  ];

  // Allow legitimate browsers and tools, but log suspicious ones
  const isSuspicious = suspiciousPatterns.some((pattern) =>
    pattern.test(userAgent),
  );

  if (isSuspicious) {
    console.warn(`Suspicious User-Agent detected: ${userAgent}`);
    // Don't block, but log for monitoring
  }

  return userAgent.length > 0 && userAgent.length <= 500;
}

export function validateIPAddress(ip: string | null): boolean {
  if (!ip || ip === "unknown") return true; // Allow unknown IPs

  // Basic IP validation (IPv4 and IPv6)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip.includes(":"); // Allow forwarded IPs
}
