import { spawn } from "child_process";
import { getNewClient } from "./database";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.development", override: false });

export interface MigrationResult {
  name: string;
  direction: "up" | "down";
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface MigrationStatus {
  appliedMigrations: string[];
  pendingMigrations: string[];
  lastMigration?: string;
  isUpToDate: boolean;
}

export interface MigrationExecutionOptions {
  timeout?: number; // in milliseconds, default 30 seconds
  direction?: "up" | "down";
  count?: number;
}

export class MigrationService {
  private readonly migrationsDir = "migrations";
  private readonly migrationsTable = "pgmigrations";
  private readonly defaultTimeout = 30000; // 30 seconds

  constructor() {
    // Ensure environment variables are loaded
    // Throw if no DB configuration is present. Tests that need to import the
    // module without a running DB should instantiate the class themselves or
    // mock the exported singleton. We avoid throwing at import-time by the
    // safe-export pattern below.
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_HOST) {
      throw new Error(
        "Database configuration not found. Please check your environment variables.",
      );
    }
  }

  /**
   * Get the current migration status
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      const client = await getNewClient();

      try {
        // Check if migrations table exists
        const tableExists = await client.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `,
          [this.migrationsTable],
        );

        if (!tableExists.rows[0].exists) {
          // No migrations table means no migrations have been run
          return {
            appliedMigrations: [],
            pendingMigrations: await this.getPendingMigrations([]),
            isUpToDate: false,
          };
        }

        // Get applied migrations
        const appliedResult = await client.query(`
          SELECT name, run_on 
          FROM ${this.migrationsTable} 
          ORDER BY run_on ASC
        `);

        const appliedMigrations = appliedResult.rows.map((row) => row.name);
        const lastMigration =
          appliedMigrations.length > 0
            ? appliedMigrations[appliedMigrations.length - 1]
            : undefined;

        const pendingMigrations =
          await this.getPendingMigrations(appliedMigrations);

        return {
          appliedMigrations,
          pendingMigrations,
          lastMigration,
          isUpToDate: pendingMigrations.length === 0,
        };
      } finally {
        await client.end().catch(() => {});
      }
    } catch (error) {
      throw new Error(
        `Failed to get migration status: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Execute pending migrations with transaction safety and detailed tracking
   */
  async runMigrations(
    options: MigrationExecutionOptions = {},
  ): Promise<MigrationResult[]> {
    const { timeout = this.defaultTimeout, direction = "up", count } = options;
    const results: MigrationResult[] = [];
    const startTime = Date.now();

    try {
      // Get current status before running migrations
      const statusBefore = await this.getMigrationStatus();

      // Validate database connection before starting
      const isConnected = await this.validateConnection();
      if (!isConnected) {
        throw new Error("Database connection validation failed");
      }

      // Build command arguments
      const args = [
        "--migrations-dir",
        this.migrationsDir,
        "--migrations-table",
        this.migrationsTable,
        "--database-url-var",
        "DATABASE_URL",
        direction,
      ];

      if (count && count > 0) {
        args.push("--count", count.toString());
      }

      // Execute node-pg-migrate with enhanced error handling
      const migrationOutput = await this.executeNodePgMigrateWithRetry(
        args,
        timeout,
      );

      // Get status after migration to track what changed
      const statusAfter = await this.getMigrationStatus();

      // Determine which migrations were actually executed
      const executedMigrations = this.determineExecutedMigrations(
        statusBefore,
        statusAfter,
        direction,
      );

      // Create results for each executed migration
      for (const migrationName of executedMigrations) {
        results.push({
          name: migrationName,
          direction,
          timestamp: new Date(),
          success: true,
        });
      }

      // If no migrations were executed, check if it's because none were pending
      if (results.length === 0) {
        if (
          migrationOutput.includes("No migrations to run") ||
          migrationOutput.includes("No migrations") ||
          statusBefore.isUpToDate
        ) {
          // This is expected - no migrations to run
          console.log("No pending migrations to execute");
        } else {
          // Unexpected - migrations should have run but didn't
          console.warn("Expected migrations to run but none were executed");
        }
      }

      return results;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTime = Date.now() - startTime;

      console.error(
        `Migration execution failed after ${executionTime}ms:`,
        errorMessage,
      );

      // Return a failed result with detailed error information
      return [
        {
          name: "migration_execution_failed",
          direction: direction,
          timestamp: new Date(),
          success: false,
          error: `Migration failed after ${executionTime}ms: ${errorMessage}`,
        },
      ];
    }
  }

  /**
   * Execute node-pg-migrate command with timeout
   */
  private async executeNodePgMigrate(
    args: string[],
    timeout: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        "npx",
        ["dotenv", "-e", ".env.development", "--", "node-pg-migrate", ...args],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env },
        },
      );

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Migration execution timed out after ${timeout}ms`));
      }, timeout);
      try {
        timeoutId.unref?.();
      } catch (e) {}

      child.on("close", (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new Error(
              `Migration failed with code ${code}: ${stderr || stdout}`,
            ),
          );
        }
      });

      child.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to execute migration: ${error.message}`));
      });
    });
  }

  /**
   * Execute node-pg-migrate with retry logic for transient failures
   */
  private async executeNodePgMigrateWithRetry(
    args: string[],
    timeout: number,
    maxRetries: number = 2,
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeNodePgMigrate(args, timeout);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        // Don't retry on certain types of errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.warn(
            `Migration attempt ${attempt} failed, retrying in ${delay}ms:`,
            lastError.message,
          );
          await new Promise((resolve) => {
            const t = setTimeout(resolve, delay);
            try {
              t.unref?.();
            } catch (e) {}
          });
        }
      }
    }

    throw lastError || new Error("Migration failed after all retry attempts");
  }

  /**
   * Determine if an error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Don't retry on syntax errors, permission errors, or migration conflicts
    return (
      message.includes("syntax error") ||
      message.includes("permission denied") ||
      message.includes("already exists") ||
      message.includes("does not exist") ||
      message.includes("constraint") ||
      message.includes("duplicate")
    );
  }

  /**
   * Determine which migrations were executed by comparing before/after status
   */
  private determineExecutedMigrations(
    statusBefore: MigrationStatus,
    statusAfter: MigrationStatus,
    direction: "up" | "down",
  ): string[] {
    if (direction === "up") {
      // Find migrations that are now applied but weren't before
      return statusAfter.appliedMigrations.filter(
        (migration) => !statusBefore.appliedMigrations.includes(migration),
      );
    } else {
      // Find migrations that were applied before but aren't now
      return statusBefore.appliedMigrations.filter(
        (migration) => !statusAfter.appliedMigrations.includes(migration),
      );
    }
  }

  /**
   * Get list of pending migrations by comparing available migration files with applied ones
   */
  private async getPendingMigrations(
    appliedMigrations: string[],
  ): Promise<string[]> {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      // Read migration files from the migrations directory
      const migrationFiles = await fs.readdir(this.migrationsDir);

      // Filter for JavaScript migration files and extract names
      const availableMigrations = migrationFiles
        .filter((file) => file.endsWith(".js"))
        .map((file) => path.basename(file, ".js"))
        .sort();

      // Find migrations that haven't been applied yet
      const pendingMigrations = availableMigrations.filter(
        (migration) => !appliedMigrations.includes(migration),
      );

      return pendingMigrations;
    } catch (error) {
      // If we can't read the migrations directory, assume no pending migrations
      console.warn(
        `Could not read migrations directory: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Validate database connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      const client = await getNewClient();
      await client.end();
      return true;
    } catch (error) {
      console.error("Database connection validation failed:", error);
      return false;
    }
  }

  /**
   * Get migration history with timestamps
   */
  async getMigrationHistory(): Promise<Array<{ name: string; runOn: Date }>> {
    try {
      const client = await getNewClient();

      try {
        // Check if migrations table exists
        const tableExists = await client.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `,
          [this.migrationsTable],
        );

        if (!tableExists.rows[0].exists) {
          return [];
        }

        const result = await client.query(`
          SELECT name, run_on as "runOn"
          FROM ${this.migrationsTable} 
          ORDER BY run_on ASC
        `);

        return result.rows;
      } finally {
        await client.end().catch(() => {});
      }
    } catch (error) {
      throw new Error(
        `Failed to get migration history: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

// Export a singleton instance for convenience
// Export a safe singleton: try to construct a real MigrationService, but if
// construction fails (for example when imported in environments without DB
// config), export a prototype-based placeholder so importing modules/tests
// won't throw at import time. Tests that explicitly call `new MigrationService()`
// still exercise the constructor behavior.
let _migrationService: MigrationService;
try {
  _migrationService = new MigrationService();
} catch (e) {
  // Create an object with the correct prototype so `instanceof` checks pass,
  // but without running the constructor.
  // This keeps imports safe in CI/tests while allowing tests to instantiate
  // the class themselves to assert constructor behavior.
  _migrationService = Object.create(
    MigrationService.prototype,
  ) as MigrationService;
}

export const migrationService = _migrationService;
