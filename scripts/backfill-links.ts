/**
 * Rellena los enlaces de las noticias ya publicadas.
 *
 * La columna links se anadio despues de que empezaran a entrar articulos, asi
 * que los anteriores la tienen vacia y el repositorio que mencionaba el
 * original se quedo sin enlazar. Este script vuelve a visitar cada original,
 * saca los enlaces de su HTML y los guarda.
 *
 * Aqui no interviene el modelo: se guardan los candidatos mejor puntuados tal
 * cual, con la etiqueta que sale del ancla del original. Cuesta cero llamadas
 * y no hay forma de que aparezca una URL inventada. El cuerpo del articulo no
 * se toca: reescribirlo para meter enlaces en linea costaria una llamada por
 * pieza y cambiaria un texto ya publicado.
 *
 *   npx tsx scripts/backfill-links.ts             todas las que esten vacias
 *   npx tsx scripts/backfill-links.ts --max=20    solo las 20 mas recientes
 *   npx tsx scripts/backfill-links.ts --dry       solo informa, no escribe
 *   npx tsx scripts/backfill-links.ts --todas     tambien las que ya tienen
 *   npx tsx scripts/backfill-links.ts --slug=x    solo esa noticia
 */
import "dotenv/config";
import { extract } from "@extractus/article-extractor";
import { query, closePool } from "../src/lib/db";
import { extraerEnlaces, type Enlace } from "../src/lib/links";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const max = Number(flag("max") || 500);
const dry = args.includes("--dry");
const todas = args.includes("--todas");
const slug = flag("slug");

// Con --slug manda el slug: se rellena esa aunque ya tenga enlaces.
const filtro = slug
  ? "WHERE slug = $2"
  : todas
    ? ""
    : "WHERE jsonb_array_length(links) = 0";

const pendientes = await query<{
  id: number;
  title: string;
  source_url: string;
}>(
  `SELECT id, title, source_url
     FROM articles
    ${filtro}
    ORDER BY published_at DESC NULLS LAST
    LIMIT $1`,
  slug ? [max, slug] : [max]
);

console.log(`${pendientes.length} articulos por revisar.\n`);

let conEnlaces = 0;
let sinEnlaces = 0;
let fallos = 0;

for (const a of pendientes) {
  try {
    const articulo = await extract(a.source_url);
    // Cuatro, el mismo tope que se le pide al modelo en la ingesta normal.
    const enlaces: Enlace[] = extraerEnlaces(articulo?.content || "", a.source_url, 4);

    if (!enlaces.length) {
      sinEnlaces++;
      console.log(`  --  ${a.title.slice(0, 62)}`);
      continue;
    }

    if (!dry) {
      await query(`UPDATE articles SET links = $2::jsonb WHERE id = $1`, [
        a.id,
        JSON.stringify(enlaces),
      ]);
    }
    conEnlaces++;
    console.log(`  ok  ${String(enlaces.length).padStart(2)} — ${a.title.slice(0, 50)}`);
    for (const e of enlaces) console.log(`        ${e.texto}  ->  ${e.url}`);
  } catch (err) {
    fallos++;
    console.log(`  XX  ${a.title.slice(0, 50)}: ${err instanceof Error ? err.message : err}`);
  }

  // Sin pausa, algunos medios cortan la conexion tras unas pocas peticiones.
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`\n--- Resumen ---`);
console.log(`Con enlaces: ${conEnlaces}${dry ? " (no guardados: --dry)" : ""}`);
console.log(`Sin enlaces: ${sinEnlaces}   (el original no llevaba ninguno util)`);
console.log(`Fallos:      ${fallos}`);

await closePool();
