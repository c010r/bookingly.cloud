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
import { firmaDistintaDelMedio, limpiarAutor } from "../src/lib/ingest";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const max = Number(flag("max") || 500);
const dry = args.includes("--dry");

// Se revisan tambien las que ya tienen firma: las primeras se guardaron
// antes de saber descartar los arrobas del propio medio.
const pendientes = await query<{
  id: number;
  title: string;
  source_url: string;
  source_name: string;
  source_author: string | null;
}>(
  `SELECT id, title, source_url, source_name, source_author
     FROM articles
    WHERE source_author IS NULL OR source_author LIKE '@%'
       OR lower(replace(source_author, ' ', '')) = lower(replace(source_name, ' ', ''))
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
    // Si ya tenia una firma valida no hace falta volver a descargar la pagina.
    const guardada = firmaDistintaDelMedio(limpiarAutor(a.source_author), a.source_name);
    const autor =
      guardada ??
      firmaDistintaDelMedio(limpiarAutor((await extract(a.source_url))?.author), a.source_name);

    if (!autor) {
      sinFirma++;
      // Puede haber una firma invalida guardada de una pasada anterior.
      if (!dry && a.source_author) {
        await query(`UPDATE articles SET source_author = NULL WHERE id = $1`, [a.id]);
      }
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
