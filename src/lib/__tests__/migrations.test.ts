import { MigrationService, migrationService } from "../migrations";
import { getNewClient } from "../database";
import { spawn } from "child_process";
import { EventEmitter } from "events";
//eslint-disable-next-line no-unused-vars
import * as fs from "fs/promises";

// Mock dependencies
jest.mock("../database");
jest.mock("child_process");

// Mock dynamic imports
const mockReaddir = jest.fn();
const mockJoin = jest.fn();

// Mock fs/promises and path modules
jest.doMock("fs/promises", () => ({
  readdir: mockReaddir,
}));

jest.doMock("path", () => ({
  join: mockJoin,
  basename: jest.fn(
    (path: string) => path.split("/").pop()?.split(".")[0] || "",
  ),
}));

const mockGetNewClient = getNewClient as jest.MockedFunction<
  typeof getNewClient
>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock client interface
const mockClient = {
  query: jest.fn(),
  end: jest.fn(),
};

// Mock child process
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn();

  constructor() {
    super();
    // Add the 'on' method to stdout and stderr to match the expected interface
    this.stdout.on = this.stdout.on.bind(this.stdout);
    this.stderr.on = this.stderr.on.bind(this.stderr);
  }
}

describe("MigrationService", () => {
  let service: MigrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Set up environment variables for tests
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    // Mock successful database client
    mockGetNewClient.mockResolvedValue(mockClient as any);
    mockClient.query.mockResolvedValue({ rows: [] });
    mockClient.end.mockResolvedValue(undefined);

    // Mock fs.readdir and path.join
    mockReaddir.mockResolvedValue([]);
    mockJoin.mockReturnValue("migrations");

    service = new MigrationService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create instance successfully with DATABASE_URL", () => {
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
      expect(() => new MigrationService()).not.toThrow();
    });

    it("should create instance successfully with POSTGRES_HOST", () => {
      delete process.env.DATABASE_URL;
      process.env.POSTGRES_HOST = "localhost";
      expect(() => new MigrationService()).not.toThrow();
    });

    it("should throw error when no database configuration is found", () => {
      delete process.env.DATABASE_URL;
      delete process.env.POSTGRES_HOST;
      expect(() => new MigrationService()).toThrow(
        "Database configuration not found",
      );
    });
  });

  describe("getMigrationStatus", () => {
    it("should return empty status when migrations table does not exist", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      // Mock the getPendingMigrations method directly
      jest
        .spyOn(service as any, "getPendingMigrations")
        .mockResolvedValue(["001_test", "002_test"]);

      const status = await service.getMigrationStatus();

      expect(status).toEqual({
        appliedMigrations: [],
        pendingMigrations: ["001_test", "002_test"],
        isUpToDate: false,
      });
    });

    it("should return correct status when migrations table exists", async () => {
      // Mock table exists check
      mockClient.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      // Mock applied migrations query
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { name: "001_initial", run_on: new Date() },
          { name: "002_users", run_on: new Date() },
        ],
      });

      // Mock the getPendingMigrations method directly
      jest
        .spyOn(service as any, "getPendingMigrations")
        .mockResolvedValue(["003_posts"]);

      const status = await service.getMigrationStatus();

      expect(status).toEqual({
        appliedMigrations: ["001_initial", "002_users"],
        pendingMigrations: ["003_posts"],
        lastMigration: "002_users",
        isUpToDate: false,
      });
    });

    it("should return up-to-date status when no pending migrations", async () => {
      // Mock table exists check
      mockClient.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      // Mock applied migrations query
      mockClient.query.mockResolvedValueOnce({
        rows: [{ name: "001_initial", run_on: new Date() }],
      });

      // Mock the getPendingMigrations method directly
      jest.spyOn(service as any, "getPendingMigrations").mockResolvedValue([]);

      const status = await service.getMigrationStatus();

      expect(status.isUpToDate).toBe(true);
      expect(status.pendingMigrations).toEqual([]);
    });

    it("should handle database connection errors", async () => {
      mockGetNewClient.mockRejectedValue(new Error("Connection failed"));

      await expect(service.getMigrationStatus()).rejects.toThrow(
        "Failed to get migration status: Connection failed",
      );
    });

    it("should handle query errors gracefully when fs.readdir fails", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      // Mock the getPendingMigrations method to simulate fs.readdir failure
      jest.spyOn(service as any, "getPendingMigrations").mockResolvedValue([]);

      const status = await service.getMigrationStatus();

      expect(status).toEqual({
        appliedMigrations: [],
        pendingMigrations: [],
        isUpToDate: false,
      });
    });

    it("should ensure client is closed even on error", async () => {
      mockClient.query.mockRejectedValue(new Error("Query failed"));

      try {
        await service.getMigrationStatus();
      } catch (error) {
        // Expected to throw
      }

      expect(mockClient.end).toHaveBeenCalled();
    });
  });

  describe("validateConnection", () => {
    it("should return true for successful connection", async () => {
      const isValid = await service.validateConnection();
      expect(isValid).toBe(true);
      expect(mockGetNewClient).toHaveBeenCalled();
      expect(mockClient.end).toHaveBeenCalled();
    });

    it("should return false for failed connection", async () => {
      mockGetNewClient.mockRejectedValue(new Error("Connection failed"));

      const isValid = await service.validateConnection();
      expect(isValid).toBe(false);
    });
  });

  describe("getMigrationHistory", () => {
    it("should return empty array when migrations table does not exist", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const history = await service.getMigrationHistory();

      expect(history).toEqual([]);
    });

    it("should return migration history when table exists", async () => {
      const mockDate1 = new Date("2023-01-01");
      const mockDate2 = new Date("2023-01-02");

      // Mock table exists check
      mockClient.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      // Mock history query
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { name: "001_initial", runOn: mockDate1 },
          { name: "002_users", runOn: mockDate2 },
        ],
      });

      const history = await service.getMigrationHistory();

      expect(history).toEqual([
        { name: "001_initial", runOn: mockDate1 },
        { name: "002_users", runOn: mockDate2 },
      ]);
    });

    it("should handle database errors", async () => {
      mockGetNewClient.mockRejectedValue(new Error("Connection failed"));

      await expect(service.getMigrationHistory()).rejects.toThrow(
        "Failed to get migration history: Connection failed",
      );
    });
  });

  describe("runMigrations", () => {
    let mockChildProcess: MockChildProcess;

    beforeEach(() => {
      mockChildProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockChildProcess as any);

      // Mock getMigrationStatus calls
      jest
        .spyOn(service, "getMigrationStatus")
        .mockResolvedValueOnce({
          appliedMigrations: ["001_initial"],
          pendingMigrations: ["002_users"],
          isUpToDate: false,
        })
        .mockResolvedValueOnce({
          appliedMigrations: ["001_initial", "002_users"],
          pendingMigrations: [],
          isUpToDate: true,
        });

      // Mock validateConnection
      jest.spyOn(service, "validateConnection").mockResolvedValue(true);
    });

    it("should execute migrations successfully", async () => {
      // Mock the private executeNodePgMigrate method directly
      jest
        .spyOn(service as any, "executeNodePgMigrate")
        .mockResolvedValue("Migration completed successfully");

      const results = await service.runMigrations();

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        name: "002_users",
        direction: "up",
        success: true,
      });
      expect(results[0].timestamp).toBeInstanceOf(Date);
    });

    it("should handle migration execution with custom options", async () => {
      // Mock the private executeNodePgMigrate method directly
      const mockExecute = jest
        .spyOn(service as any, "executeNodePgMigrate")
        .mockResolvedValue("Migration completed");

      await service.runMigrations({
        direction: "down",
        count: 1,
        timeout: 60000,
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.arrayContaining([
          "--migrations-dir",
          "migrations",
          "--migrations-table",
          "pgmigrations",
          "--database-url-var",
          "DATABASE_URL",
          "down",
          "--count",
          "1",
        ]),
        60000,
      );
    });

    it("should handle migration process errors", async () => {
      // Mock the private executeNodePgMigrateWithRetry method to avoid retry delays
      jest
        .spyOn(service as any, "executeNodePgMigrateWithRetry")
        .mockRejectedValue(
          new Error("Migration failed with code 1: Migration error occurred"),
        );

      const results = await service.runMigrations();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain("Migration failed with code 1");
    });

    it("should handle database connection validation failure", async () => {
      jest.spyOn(service, "validateConnection").mockResolvedValue(false);

      const results = await service.runMigrations();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain(
        "Database connection validation failed",
      );
    });

    it("should handle no pending migrations gracefully", async () => {
      // Clear previous mocks and set up new ones for this test
      jest.clearAllMocks();

      // Mock status showing no pending migrations for both calls
      jest
        .spyOn(service, "getMigrationStatus")
        .mockResolvedValueOnce({
          appliedMigrations: ["001_initial"],
          pendingMigrations: [],
          isUpToDate: true,
        })
        .mockResolvedValueOnce({
          appliedMigrations: ["001_initial"],
          pendingMigrations: [],
          isUpToDate: true,
        });

      // Mock validateConnection
      jest.spyOn(service, "validateConnection").mockResolvedValue(true);

      // Mock the private executeNodePgMigrate method
      jest
        .spyOn(service as any, "executeNodePgMigrate")
        .mockResolvedValue("No migrations to run");

      // Mock determineExecutedMigrations to return empty array
      jest
        .spyOn(service as any, "determineExecutedMigrations")
        .mockReturnValue([]);

      const results = await service.runMigrations();

      expect(results).toHaveLength(0);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(migrationService).toBeInstanceOf(MigrationService);
    });
  });
});
