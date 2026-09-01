import pg from "pg";
import { env } from "./env";

// Un unico pool por proceso, incluso con el hot-reload de Next en desarrollo.
// Se crea de forma perezosa para que `next build` no exija DATABASE_URL.
const globalForPg = globalThis as unknown as { __c010rPool?: pg.Pool };

export function getPool(): pg.Pool {
  if (!globalForPg.__c010rPool) {
    globalForPg.__c010rPool = new pg.Pool({
      connectionString: env.databaseUrl,
      ssl: env.pgSsl ? { rejectUnauthorized: false } : undefined,
      max: 8,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalForPg.__c010rPool;
}

/** Cierra el pool. Solo para scripts de linea de comandos. */
export async function closePool(): Promise<void> {
  if (globalForPg.__c010rPool) {
    await globalForPg.__c010rPool.end();
    globalForPg.__c010rPool = undefined;
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
