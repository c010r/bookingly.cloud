/**
 * Pasa el detector de repetidas por los articulos ya publicados y agrupa los
 * que cuentan la misma noticia. Existe porque el detector estuvo demasiado
 * estricto y dejo pasar grupos enteros: siete piezas del mismo lanzamiento.
 *
 *   npm run dedupe:historico              -> solo informa, no toca nada
 *   npm run dedupe:historico -- --dias=7  -> mira una semana atras
 *   npm run dedupe:historico -- --aplicar -> consolida de verdad
 *
 * De cada grupo se conserva una pieza y las demas pasan a borrador. No se
 * borra nada: revertir es devolver el status a 'published'. Antes de tocar
 * nada imprime el SQL exacto para deshacerlo.
 */
import "dotenv/config";
import { query, closePool } from "../src/lib/db";
import { similarity, UMBRAL_DUPLICADO } from "../src/lib/dedupe";

type Fila = {
  id: number;
  title: string;
  source_title: string;
  source_name: string;
  source_url: string;
  slug: string;
  quality_score: number | null;
  views: number;
  created_at: string;
};

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const dias = Number(args.find((a) => a.startsWith("--dias="))?.split("=")[1] ?? 3);
/**
 * Mas exigente que la ingesta a proposito. Alli un error afecta a una pieza;
 * aqui la agrupacion es transitiva y un solo enlace flojo puede encadenar tres
 * articulos que no tienen nada que ver. Se puede bajar con --umbral=0.44.
 */
const umbral = Number(
  args.find((a) => a.startsWith("--umbral="))?.split("=")[1] ?? Math.max(UMBRAL_DUPLICADO, 0.5)
);

/**
 * Ids de articulos cuyo grupo se deja en paz. Para los que agrupa mal: tres
 * ofertas distintas encadenadas por "Best Buy" y "Labor Day" no son la misma
 * noticia, y revisar el informe antes de aplicar es parte del procedimiento.
 */
const excluidos = new Set(
  (args.find((a) => a.startsWith("--excluir="))?.split("=")[1] ?? "")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
);

const filas = await query<Fila>(
  `SELECT id, title, source_title, source_name, source_url, slug,
          quality_score, views, created_at
     FROM articles
    WHERE status = 'published'
      AND created_at > now() - ($1 || ' days')::interval
    ORDER BY created_at`,
  [String(dias)]
);

console.log(`${filas.length} articulos publicados en los ultimos ${dias} dias.\n`);

/** Mismo criterio que la ingesta: los cuatro cruces de titulares. */
function parecido(a: Fila, b: Fila): number {
  return Math.max(
    similarity(a.title, b.title),
    similarity(a.source_title, b.source_title),
    similarity(a.title, b.source_title),
    similarity(a.source_title, b.title)
  );
}

// Agrupacion transitiva: si A se parece a B y B a C, los tres son el mismo
// grupo aunque A y C no se toquen. Es lo que pasaba con las piezas de Poco,
// enlazadas en cadena a traves de las intermedias.
const grupoDe = new Map<number, number>();
for (const f of filas) grupoDe.set(f.id, f.id);
const raiz = (id: number): number => {
  let r = id;
  while (grupoDe.get(r) !== r) r = grupoDe.get(r)!;
  return r;
};
for (let i = 0; i < filas.length; i++) {
  for (let j = i + 1; j < filas.length; j++) {
    if (parecido(filas[i], filas[j]) >= umbral) {
      const ri = raiz(filas[i].id);
      const rj = raiz(filas[j].id);
      if (ri !== rj) grupoDe.set(rj, ri);
    }
  }
}

const grupos = new Map<number, Fila[]>();
for (const f of filas) {
  const r = raiz(f.id);
  if (!grupos.has(r)) grupos.set(r, []);
  grupos.get(r)!.push(f);
}
const repetidos = [...grupos.values()]
  .filter((g) => g.length > 1)
  .filter((g) => {
    if (!g.some((f) => excluidos.has(f.id))) return true;
    console.log(`Grupo excluido a mano: ${g.map((f) => "#" + f.id).join(" ")}`);
    return false;
  });

if (repetidos.length === 0) {
  console.log("No hay grupos repetidos. Nada que hacer.");
  await closePool();
  process.exit(0);
}

/**
 * Cual se queda. Manda la que ya tiene visitas, porque puede estar enlazada o
 * indexada; a igualdad, la mejor valorada, y en ultimo termino la primera que
 * se publico.
 */
function ordenarPorInteres(g: Fila[]): Fila[] {
  return [...g].sort(
    (a, b) =>
      b.views - a.views ||
      (b.quality_score ?? 0) - (a.quality_score ?? 0) ||
      a.id - b.id
  );
}

let totalRetirados = 0;
const aRetirar: { id: number; conservado: number; extra: Fila }[] = [];

for (const g of repetidos) {
  const [conservado, ...resto] = ordenarPorInteres(g);
  console.log(`\nGrupo de ${g.length} — se conserva #${conservado.id} (${conservado.views} visitas, calidad ${conservado.quality_score ?? "?"})`);
  console.log(`   QUEDA    ${conservado.title.slice(0, 78)}`);
  for (const r of resto) {
    console.log(`   a borrador #${r.id} (${r.views} visitas, calidad ${r.quality_score ?? "?"}) ${r.title.slice(0, 60)}`);
    aRetirar.push({ id: r.id, conservado: conservado.id, extra: r });
    totalRetirados++;
  }
}

console.log(`\n=== ${repetidos.length} grupos, ${totalRetirados} articulos pasarian a borrador ===`);

if (!aplicar) {
  console.log("\nEsto ha sido solo un informe. Para aplicarlo:");
  console.log(`  npm run dedupe:historico -- --aplicar --dias=${dias} --umbral=${umbral}`);
  await closePool();
  process.exit(0);
}

console.log(`\nPara deshacerlo entero:\n  UPDATE articles SET status='published' WHERE id IN (${aRetirar.map((r) => r.id).join(",")});\n`);

for (const r of aRetirar) {
  // El medio del duplicado se conserva como fuente adicional del que queda,
  // que es lo que habria hecho la ingesta de haberlo detectado a tiempo.
  await query(
    `UPDATE articles
        SET extra_sources = extra_sources || $2::jsonb, updated_at = now()
      WHERE id = $1
        AND source_url <> $3
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(extra_sources) AS e WHERE e->>'url' = $3
        )`,
    [
      r.conservado,
      JSON.stringify([
        {
          name: r.extra.source_name,
          url: r.extra.source_url,
          title: r.extra.source_title,
          added_at: new Date().toISOString(),
        },
      ]),
      r.extra.source_url,
    ]
  );
  await query(`UPDATE articles SET status = 'draft', updated_at = now() WHERE id = $1`, [r.id]);
}

console.log(`Hecho: ${totalRetirados} articulos a borrador, sus medios anadidos como fuente adicional.`);
await closePool();
