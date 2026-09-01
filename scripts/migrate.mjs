// Aplica db/schema.sql contra DATABASE_URL.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (copia .env.example a .env).");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
await client.query(sql);
await client.end();
console.log("Esquema aplicado correctamente.");
