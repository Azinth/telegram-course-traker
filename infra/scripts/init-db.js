/* Simple initializer: runs sql/init.sql against current DATABASE_URL */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: ".env.development" });

function buildConnectionString() {
  let databaseUrl = process.env.DATABASE_URL;

  // If DATABASE_URL is not set or contains unexpanded shell placeholders like $POSTGRES_USER,
  // build it from individual POSTGRES_* variables.
  if (!databaseUrl || databaseUrl.includes("$")) {
    const host = process.env.POSTGRES_HOST || "localhost";
    const port = process.env.POSTGRES_PORT || "5490";
    const user = process.env.POSTGRES_USER || "postgres";
    const password = process.env.POSTGRES_PASSWORD || "postgres";
    const db = process.env.POSTGRES_DB || "postgres";

    // encode user/password to ensure special chars are safe in a URL
    const userEnc = encodeURIComponent(user);
    const passEnc = encodeURIComponent(password);

    databaseUrl = `postgres://${userEnc}:${passEnc}@${host}:${port}/${db}`;
  }

  return databaseUrl;
}

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "sql", "init.sql"),
    "utf8",
  );
  const connectionString = buildConnectionString();
  if (!connectionString) {
    console.error(
      "DATABASE_URL não está definida e não foi possível construir a partir de POSTGRES_*",
    );
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();
  await client.query(sql);
  // run migrations in sql/migrations (alphabetical)
  const migrationsDir = path.join(__dirname, "..", "sql", "migrations");
  if (fs.existsSync(migrationsDir)) {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      const msql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
      if (msql.trim()) {
        console.log("Running migration:", f);
        await client.query(msql);
      }
    }
  }
  await client.end();
  console.log("DB initialized.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
