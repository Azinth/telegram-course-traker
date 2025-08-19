import { getNewClient, query } from "../database";
import { Client } from "pg";

// Mock pg Client
jest.mock("pg");

const MockClient = Client as jest.MockedClass<typeof Client>;

describe("Database utilities", () => {
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      connect: jest.fn(),
      end: jest.fn(),
      query: jest.fn(),
    } as any;

    MockClient.mockImplementation(() => mockClient);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.VERCEL_POSTGRES_URL;
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_PASSWORD;
  });

  describe("getNewClient", () => {
    describe("Vercel environment", () => {
      beforeEach(() => {
        process.env.VERCEL = "1";
        process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      });

      it("should create client with DATABASE_URL in Vercel environment", async () => {
        mockClient.connect.mockResolvedValue(undefined);

        const client = await getNewClient();

        expect(MockClient).toHaveBeenCalledWith({
          connectionString: "postgresql://user:pass@localhost:5432/db",
          ssl: { rejectUnauthorized: false },
        });
        expect(mockClient.connect).toHaveBeenCalled();
        expect(client).toBe(mockClient);
      });

      it("should use POSTGRES_URL when DATABASE_URL contains localhost", async () => {
        process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
        process.env.POSTGRES_URL = "postgresql://user:pass@vercel-host:5432/db";
        mockClient.connect.mockResolvedValue(undefined);

        await getNewClient();

        expect(MockClient).toHaveBeenCalledWith({
          connectionString: "postgresql://user:pass@vercel-host:5432/db",
          ssl: { rejectUnauthorized: false },
        });
      });

      it("should use VERCEL_POSTGRES_URL when available", async () => {
        process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
        process.env.VERCEL_POSTGRES_URL =
          "postgresql://user:pass@vercel-host2:5432/db";
        mockClient.connect.mockResolvedValue(undefined);

        await getNewClient();

        expect(MockClient).toHaveBeenCalledWith({
          connectionString: "postgresql://user:pass@vercel-host2:5432/db",
          ssl: { rejectUnauthorized: false },
        });
      });

      it("should throw error when DATABASE_URL is not defined in Vercel", async () => {
        delete process.env.DATABASE_URL;

        await expect(getNewClient()).rejects.toThrow(
          "DATABASE_URL não está definida",
        );
      });

      it("should detect Vercel environment with VERCEL_ENV=production", async () => {
        delete process.env.VERCEL;
        process.env.VERCEL_ENV = "production";
        process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db";
        mockClient.connect.mockResolvedValue(undefined);

        await getNewClient();

        expect(MockClient).toHaveBeenCalledWith({
          connectionString: "postgresql://user:pass@host:5432/db",
          ssl: { rejectUnauthorized: false },
        });
      });

      it("should detect Vercel environment with VERCEL_ENV=preview", async () => {
        delete process.env.VERCEL;
        process.env.VERCEL_ENV = "preview";
        process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db";
        mockClient.connect.mockResolvedValue(undefined);

        await getNewClient();

        expect(MockClient).toHaveBeenCalledWith({
          connectionString: "postgresql://user:pass@host:5432/db",
          ssl: { rejectUnauthorized: false },
        });
      });
    });

    describe("Local development environment", () => {
      it("should create client with default local configuration", async () => {
        mockClient.connect.mockResolvedValue(undefined);

        const client = await getNewClient();

        expect(MockClient).toHaveBeenCalledWith({
          host: "localhost",
          port: 5451,
          user: "postgres",
          database: "postgres",
          password: "postgres",
        });
        expect(mockClient.connect).toHaveBeenCalled();
        expect(client).toBe(mockClient);
      });

      it("should use custom environment variables when provided", async () => {
        process.env.POSTGRES_HOST = "custom-host";
        process.env.POSTGRES_PORT = "5433";
        process.env.POSTGRES_USER = "custom-user";
        process.env.POSTGRES_DB = "custom-db";
        process.env.POSTGRES_PASSWORD = "custom-pass";
        mockClient.connect.mockResolvedValue(undefined);

        await getNewClient();

        expect(MockClient).toHaveBeenCalledWith({
          host: "custom-host",
          port: 5433,
          user: "custom-user",
          database: "custom-db",
          password: "custom-pass",
        });
      });

      it("should handle connection errors", async () => {
        const connectionError = new Error("Connection failed");
        mockClient.connect.mockRejectedValue(connectionError);

        await expect(getNewClient()).rejects.toThrow("Connection failed");
      });
    });
  });

  describe("query", () => {
    beforeEach(() => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.end.mockResolvedValue(undefined);
    });

    it("should execute query successfully and close connection", async () => {
      const mockResult = { rows: [{ id: 1, name: "test" }], rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult as any);

      const result = await query("SELECT * FROM users WHERE id = $1", [1]);

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1",
        [1],
      );
      expect(mockClient.end).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });

    it("should execute query without parameters", async () => {
      const mockResult = { rows: [{ count: 5 }], rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult as any);

      const result = await query("SELECT COUNT(*) FROM users");

      expect(mockClient.query).toHaveBeenCalledWith(
        "SELECT COUNT(*) FROM users",
        undefined,
      );
      expect(result).toBe(mockResult);
    });

    it("should close connection even when query fails", async () => {
      const queryError = new Error("Query failed");
      mockClient.query.mockRejectedValue(queryError);

      await expect(query("INVALID SQL")).rejects.toThrow("Query failed");
      expect(mockClient.end).toHaveBeenCalled();
    });

    it("should handle connection creation failure", async () => {
      const connectionError = new Error("Connection failed");
      mockClient.connect.mockRejectedValue(connectionError);

      await expect(query("SELECT 1")).rejects.toThrow("Connection failed");
    });

    it("should handle client.end() errors gracefully", async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockClient.query.mockResolvedValue(mockResult as any);
      mockClient.end.mockRejectedValue(new Error("End failed"));

      // Should not throw even if end() fails
      const result = await query("SELECT 1");
      expect(result).toBe(mockResult);
    });

    it("should handle both query and end errors", async () => {
      const queryError = new Error("Query failed");
      mockClient.query.mockRejectedValue(queryError);
      mockClient.end.mockRejectedValue(new Error("End failed"));

      // Should throw the query error, not the end error
      await expect(query("INVALID SQL")).rejects.toThrow("Query failed");
    });
  });

  describe("environment detection", () => {
    it("should correctly identify non-Vercel environment", async () => {
      // Ensure no Vercel environment variables are set
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;

      mockClient.connect.mockResolvedValue(undefined);

      await getNewClient();

      // Should use local configuration
      expect(MockClient).toHaveBeenCalledWith({
        host: "localhost",
        port: 5451,
        user: "postgres",
        database: "postgres",
        password: "postgres",
      });
    });
  });
});
