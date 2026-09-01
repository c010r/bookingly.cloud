/**
 * Rellena la firma de las noticias ya publicadas.
 *
 * source_author se anadio despues de que empezaran a entrar articulos, asi que
 * los anteriores lo tienen vacio. Este script vuelve a visitar cada original y
 * recupera quien lo escribio.
 *
 *   npx tsx scripts/backfill-authors.ts            todas las que falten
 *   npx tsx scripts/backfill-authors.ts --max=20   solo las 20 mas recientes
 *   npx tsx scripts/backfill-authors.ts --dry      solo informa, no escribe
 */
import "dotenv/config";
import { extract } from "@extractus/article-extractor";
import { query, closePool } from "../src/lib/db";
import { limpiarAutor } from "../src/lib/ingest";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const max = Number(flag("max") || 500);
const dry = args.includes("--dry");

const pendientes = await query<{ id: number; title: string; source_url: string }>(
  `SELECT id, title, source_url
     FROM articles
    WHERE source_author IS NULL
    ORDER BY published_at DESC NULLS LAST
    LIMIT $1`,
  [max]
);

console.log(`${pendientes.length} articulos sin firma.\n`);

let encontrados = 0;
let sinFirma = 0;
let fallos = 0;

for (const a of pendientes) {
  try {
    const art = await extract(a.source_url);
    const autor = limpiarAutor(art?.author);

    if (!autor) {
      sinFirma++;
      console.log(`  --  ${a.title.slice(0, 62)}`);
      continue;
    }

    if (!dry) {
      await query(`UPDATE articles SET source_author = $2 WHERE id = $1`, [a.id, autor]);
    }
    encontrados++;
    console.log(`  ok  ${autor.padEnd(26)} ${a.title.slice(0, 50)}`);
  } catch (err) {
    fallos++;
    console.log(`  XX  ${a.title.slice(0, 50)}: ${err instanceof Error ? err.message : err}`);
  }

  // Sin pausa, algunos medios cortan la conexion tras unas pocas peticiones.
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`\n--- Resumen ---`);
console.log(`Con firma:  ${encontrados}${dry ? " (no guardados: --dry)" : ""}`);
console.log(`Sin firma:  ${sinFirma}   (el original no la publica)`);
console.log(`Fallos:     ${fallos}`);

await closePool();
