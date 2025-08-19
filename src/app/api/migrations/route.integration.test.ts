import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { migrationService } from "@/lib/migrations";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateCSRFHeaders } from "@/lib/csrf-protection";
import { headers } from "next/headers";

// Mock dependencies
jest.mock("next-auth");
jest.mock("@/lib/auth");
jest.mock("@/lib/migrations");
jest.mock("@/lib/rate-limit");
jest.mock("@/lib/csrf-protection");
jest.mock("next/headers");
jest.mock("@/lib/database", () => ({
  query: jest
    .fn()
    .mockResolvedValue({ rows: [{ id: "1", name: "Test User" }] }),
}));
jest.mock("@/lib/validation/migration-schemas", () => ({
  migrationExecutionSchema: {
    parse: jest.fn((data) => data),
  },
  migrationStatusQuerySchema: {
    parse: jest.fn((data) => data),
  },
  validateRequestSize: jest.fn(() => true),
  validateContentType: jest.fn(() => true),
  validateUserAgent: jest.fn(() => true),
  validateIPAddress: jest.fn(() => true),
  sanitizeString: jest.fn((str) => str),
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockMigrationService = migrationService as jest.Mocked<
  typeof migrationService
>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<
  typeof checkRateLimit
>;
const mockValidateCSRFHeaders = validateCSRFHeaders as jest.MockedFunction<
  typeof validateCSRFHeaders
>;
const mockHeaders = headers as jest.MockedFunction<typeof headers>;

// Mock headers implementation
const createMockHeaders = (headerMap: Record<string, string> = {}) => {
  const defaultHeaders: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "x-forwarded-for": "192.168.1.1",
    ...headerMap,
  };

  return {
    get: jest.fn((key: string) => defaultHeaders[key.toLowerCase()] || null),
    has: jest.fn((key: string) => key.toLowerCase() in defaultHeaders),
    keys: jest.fn(() => Object.keys(defaultHeaders)),
    values: jest.fn(() => Object.values(defaultHeaders)),
    entries: jest.fn(() => Object.entries(defaultHeaders)),
    forEach: jest.fn(),
    append: jest.fn(),
    delete: jest.fn(),
    getSetCookie: jest.fn(() => []),
    set: jest.fn(),
    [Symbol.iterator]: jest.fn(),
  } as any;
};

// Mock console.log and console.error to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe("/api/migrations Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockHeaders.mockReturnValue(createMockHeaders());
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 60000,
    });
    mockValidateCSRFHeaders.mockReturnValue(true);
  });

  describe("GET /api/migrations", () => {
    const createGetRequest = (url = "http://localhost:3000/api/migrations") => {
      return new Request(url, { method: "GET" });
    };

    it("should return migration status for authenticated admin user", async () => {
      // Setup mocks
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.getMigrationStatus.mockResolvedValue({
        appliedMigrations: ["001_initial_setup"],
        pendingMigrations: ["002_add_users"],
        lastMigration: "001_initial_setup",
        isUpToDate: false,
      });

      // Set admin email in environment
      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status.appliedMigrations).toEqual(["001_initial_setup"]);
      expect(data.status.pendingMigrations).toEqual(["002_add_users"]);
      expect(data.message).toContain("1 pending migration(s) found");
    });

    it("should return up-to-date status when no pending migrations", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.getMigrationStatus.mockResolvedValue({
        appliedMigrations: ["001_initial_setup", "002_add_users"],
        pendingMigrations: [],
        lastMigration: "002_add_users",
        isUpToDate: true,
      });

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status.isUpToDate).toBe(true);
      expect(data.message).toContain("Database is up to date");
    });

    it("should return 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("unauthorized");
      expect(data.details).toContain("Authentication required");
    });

    it("should return 403 for non-admin users", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "user@example.com" },
      });

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("forbidden");
      expect(data.details).toContain("Insufficient permissions");
    });

    it("should return 429 when rate limit is exceeded", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      });

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe("rate_limit_exceeded");
      expect(response.headers.get("Retry-After")).toBe("60");
    });

    it("should return 400 for invalid User-Agent", async () => {
      mockHeaders.mockReturnValue(
        createMockHeaders({
          "user-agent": "invalid-bot",
        }),
      );

      // Mock validation to return false for invalid user agent
      const {
        validateUserAgent,
      } = require("@/lib/validation/migration-schemas");
      validateUserAgent.mockReturnValueOnce(false);

      const request = createGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("bad_request");
      expect(data.details).toContain("Invalid User-Agent");
    });

    it("should return 500 when migration service throws error", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.getMigrationStatus.mockRejectedValue(
        new Error("Database connection failed"),
      );

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("internal_server_error");
      expect(data.details).toContain("Database connection failed");
    });
  });

  describe("POST /api/migrations", () => {
    const createPostRequest = (
      body?: any,
      headers?: Record<string, string>,
    ) => {
      return new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    };

    it("should execute migrations successfully for authenticated admin user", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.runMigrations.mockResolvedValue([
        {
          name: "002_add_users",
          direction: "up",
          timestamp: new Date(),
          success: true,
        },
      ]);

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createPostRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(1);
      expect(data.message).toContain("Successfully executed 1 migration");
    });

    it("should handle no pending migrations", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.runMigrations.mockResolvedValue([]);

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createPostRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(0);
      expect(data.message).toContain("No pending migrations to execute");
    });

    it("should return 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createPostRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("unauthorized");
      expect(data.details).toContain("Authentication required");
    });

    it("should return 403 for non-admin users", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "user@example.com" },
      });

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createPostRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("forbidden");
      expect(data.details).toContain("Insufficient permissions");
    });

    it("should return 403 when CSRF validation fails", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockValidateCSRFHeaders.mockReturnValue(false);

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createPostRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("forbidden");
      expect(data.details).toContain("CSRF validation failed");
    });

    it("should return 500 when migration service throws error", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.runMigrations.mockRejectedValue(
        new Error("Migration execution failed"),
      );

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = createPostRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("internal_server_error");
      expect(data.details).toContain("Migration execution failed");
    });
  });

  describe("Authentication and Authorization", () => {
    it("should allow any authenticated user when no admin emails configured", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "anyuser@example.com" },
      });

      mockMigrationService.getMigrationStatus.mockResolvedValue({
        appliedMigrations: [],
        pendingMigrations: [],
        isUpToDate: true,
      });

      delete process.env.MIGRATION_ADMIN_EMAILS;

      const request = new Request("http://localhost:3000/api/migrations", {
        method: "GET",
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should handle database user lookup failures gracefully", async () => {
      const { query } = require("@/lib/database");
      query.mockRejectedValueOnce(new Error("Database connection failed"));

      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = new Request("http://localhost:3000/api/migrations", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("forbidden");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle partial migration failures", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.runMigrations.mockResolvedValue([
        {
          name: "002_add_users",
          direction: "up",
          timestamp: new Date(),
          success: true,
        },
        {
          name: "003_add_courses",
          direction: "up",
          timestamp: new Date(),
          success: false,
          error: "Column already exists",
        },
      ]);

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.results).toHaveLength(2);
      expect(data.message).toContain("1 success(es) and 1 failure(s)");
    });

    it("should handle empty request body", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.runMigrations.mockResolvedValue([]);

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockMigrationService.runMigrations).toHaveBeenCalledWith({});
    });

    it("should log security events appropriately", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });

      mockMigrationService.getMigrationStatus.mockResolvedValue({
        appliedMigrations: [],
        pendingMigrations: [],
        isUpToDate: true,
      });

      process.env.MIGRATION_ADMIN_EMAILS = "admin@example.com";

      const request = new Request("http://localhost:3000/api/migrations", {
        method: "GET",
      });

      await GET(request);

      // Verify that console.log was called for security logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[SECURITY]"),
        expect.any(Object),
      );
    });
  });
});
