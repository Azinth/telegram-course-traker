import { Client, ClientConfig } from "pg";
import { config } from "dotenv";
config({ path: ".env.development", override: false });

function isVercel() {
  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

export async function getNewClient() {
  let clientConfig: ClientConfig;

  if (isVercel()) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL não está definida");

    let connectionString = databaseUrl;
    if (
      databaseUrl.includes("localhost") ||
      databaseUrl.includes("127.0.0.1")
    ) {
      const vercelDatabaseUrl =
        process.env.POSTGRES_URL ||
        process.env.VERCEL_POSTGRES_URL ||
        process.env.DATABASE_URL;
      connectionString = vercelDatabaseUrl!;
    }

    clientConfig = {
      connectionString,
      ssl: { rejectUnauthorized: false },
    };
  } else {
    clientConfig = {
      host: process.env.POSTGRES_HOST || "localhost",
      port: Number(process.env.POSTGRES_PORT || 5451),
      user: process.env.POSTGRES_USER || "postgres",
      database: process.env.POSTGRES_DB || "postgres",
      password: process.env.POSTGRES_PASSWORD || "postgres",
    };
  }

  const client = new Client(clientConfig);
  await client.connect();
  return client;
}

export async function query(q: string, params?: any[]) {
  const client = await getNewClient();
  try {
    const res = await client.query(q, params);
    return res;
  } finally {
    await client.end().catch(() => {});
  }
}
