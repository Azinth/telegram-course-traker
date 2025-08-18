import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.development" });

export async function getNewClient() {
  // Verifica explicitamente se está rodando na Vercel
  const isVercel =
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview";

  // Define a configuração do cliente
  let clientConfig;

  if (isVercel) {
    // Verificar se DATABASE_URL está definida explicitamente
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.error("DATABASE_URL não está definida no ambiente Vercel");
      throw new Error("DATABASE_URL não está definida");
    }

    // Verificar se a URL não é a local
    if (
      databaseUrl.includes("localhost") ||
      databaseUrl.includes("127.0.0.1")
    ) {
      console.error(
        "DATABASE_URL contém referência a banco de dados local:",
        databaseUrl,
      );

      // Usar o valor de DATABASE_URL da Vercel diretamente
      const vercelDatabaseUrl =
        process.env.POSTGRES_URL ||
        process.env.VERCEL_POSTGRES_URL ||
        process.env.DATABASE_URL;

      console.log("Tentando usar URL alternativa do banco de dados");

      clientConfig = {
        connectionString: vercelDatabaseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
      };
    } else {
      console.log("Usando DATABASE_URL para conexão remota");
      clientConfig = {
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
      };
    }
  } else {
    // Em desenvolvimento local, usar variáveis separadas
    clientConfig = {
      host: process.env.POSTGRES_HOST || "localhost",
      port: process.env.POSTGRES_PORT || 5490,
      user: process.env.POSTGRES_USER || "postgres",
      database: process.env.POSTGRES_DB || "postgres",
      password: process.env.POSTGRES_PASSWORD || "postgres",
    };
  }

  try {
    // Cria uma nova instância de Client usando a configuração definida
    const client = new Client(clientConfig);
    await client.connect();
    return client;
  } catch (err) {
    console.error("Erro ao conectar ao banco de dados:", err);
    throw err;
  }
}

export async function query(queryTextOrConfig, values) {
  let client;
  try {
    client = await getNewClient();

    // Lidar com diferentes formatos de entrada
    let result;
    if (values !== undefined) {
      // Formato: query(text, values)
      result = await client.query(queryTextOrConfig, values);
    } else if (typeof queryTextOrConfig === "string") {
      // Formato: query(text)
      result = await client.query(queryTextOrConfig);
    } else {
      // Formato: query({ text, values, ... })
      result = await client.query(queryTextOrConfig);
    }

    return result;
  } catch (error) {
    console.error("Erro na consulta SQL:", error);
    throw error;
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (err) {
        console.error("Erro ao fechar conexão:", err);
      }
    }
  }
}

const database = {
  query,
  getNewClient,
};

export default database;
