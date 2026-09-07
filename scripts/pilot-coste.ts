/**
 * Mide cuanto cuesta rehacer notas reales con el modelo actual del .env.
 *
 * Coge las N notas publicadas mas recientes, vuelve a descargar el original
 * (en la base solo se guarda la URL, no el texto) y las reescribe llamando al
 * proveedor de verdad. No toca la base de datos: nada de lo que escriba llega
 * al sitio. Solo sirve para saber que sale cada nota y si el modelo responde
 * bien, antes de decidir un cambio de proveedor.
 *
 *   npx tsx scripts/pilot-coste.ts --limit=100
 *
 * El resultado por nota va a un JSONL (--salida) y las reescrituras buenas, a
 * otro con el cuerpo entero (--ok) para poder revisarlas. Lanza en el orden en
 * que llegan las notas, una detras de otra, igual que la ingesta real.
 */
import "dotenv/config";
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { query, closePool } from "../src/lib/db";
import { rewriteArticle, FueraDeFocoError } from "../src/lib/rewriter";
import { fetchArticleText } from "../src/lib/ingest";
import { env } from "../src/lib/env";
import { usoDeSesion, reiniciarUsoSesion } from "../src/lib/llm";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];

const limit = Number(flag("limit") ?? 100);
const salida = flag("salida") ?? "/tmp/pilot-coste.jsonl";
const okFile = flag("ok") ?? "/tmp/pilot-coste-ok.jsonl";

// Precios de deepseek-v4-flash (USD por 1M de tokens, sin cache en entrada).
const PRECIO_IN = { offpeak: 0.22, peak: 0.44 };
const PRECIO_OUT = { offpeak: 0.66, peak: 1.32 };

type Fila = {
  id: number;
  source_name: string;
  source_url: string;
  source_title: string;
  source_published_at: Date | null;
  kind: string | null;
  links: string | null;
};

function aseguraDir(p: string) {
  mkdirSync(dirname(p), { recursive: true });
}

function coste(t: { prompt: number; completion: number }) {
  return {
    offpeak: (t.prompt / 1e6) * PRECIO_IN.offpeak + (t.completion / 1e6) * PRECIO_OUT.offpeak,
    peak: (t.prompt / 1e6) * PRECIO_IN.peak + (t.completion / 1e6) * PRECIO_OUT.peak,
  };
}

const procesadas = new Set<number>();
if (existsSync(salida)) {
  for (const linea of readFileSync(salida, "utf8").split("\n")) {
    const m = linea.match(/"id":(\d+)/);
    if (m) procesadas.add(Number(m[1]));
  }
}

reiniciarUsoSesion();
console.log(`Proveedor: ${env.llmBaseUrl}`);
console.log(
  `Modelos:   ${env.llmModels.map((m) => (m.esfuerzo ? `${m.nombre}:${m.esfuerzo}` : m.nombre)).join(", ")}`
);
console.log(`Notas a reescribir: ${limit} (resume desde ${procesadas.size} ya hechas)`);
console.log();

const filas = await query<Fila>(
  `SELECT a.id, a.source_name, a.source_url, a.source_title, a.source_published_at,
          COALESCE(s.kind, 'rss') AS kind, a.links::text AS links
     FROM articles a
     LEFT JOIN sources s ON s.id = a.source_id
    WHERE a.status = 'published'
    ORDER BY a.published_at DESC
    LIMIT $1`,
  [limit]
);

const resumen = {
  total: 0,
  ok: 0,
  rechazo: 0,
  error: 0,
  sinFuente: 0,
  tokens: { prompt: 0, completion: 0, razonamiento: 0, total: 0 }, // todo lo gastado
  tokensOk: { prompt: 0, completion: 0, razonamiento: 0, total: 0 }, // solo notas buenas
  errores: [] as string[],
};

for (const fila of filas) {
  if (procesadas.has(fila.id)) continue;
  resumen.total++;

  const antes = usoDeSesion();
  let estado = "error";
  let err = "";
  let titulo = "";

  try {
    // El original no se guarda en la base: hay que volver a por el. Si el medio
    // ya no responde, no hay con que escribir y la nota se descarta sin gasto.
    const { text, links } = await fetchArticleText({
      title: fila.source_title,
      link: fila.source_url,
      summary: "",
      publishedAt: fila.source_published_at,
      author: null,
      image: null,
      contentHtml: "",
    });
    if (text.trim().length < 200) {
      estado = "sin-fuente";
      err = "el original ya no se puede descargar o no tiene texto";
    } else {
      const enlaces = links
        .concat(JSON.parse(fila.links ?? "[]") as { url: string; texto: string }[])
        .slice(0, 6);
      const r = await rewriteArticle({
        sourceTitle: fila.source_title,
        sourceUrl: fila.source_url,
        sourceName: fila.source_name,
        content: text,
        publishedAt: fila.source_published_at,
        enlaces,
      });
      estado = "ok";
      titulo = r.title;
      appendFileSync(okFile, `${JSON.stringify({ ...fila, rewrite: r })}\n`);
    }
  } catch (e) {
    if (e instanceof FueraDeFocoError) {
      estado = "rechazo";
      err = e.motivo;
    } else {
      estado = "error";
      err = e instanceof Error ? e.message : String(e);
    }
  }

  const tokens = usoDeSesion();
  const gasto = {
    prompt: tokens.prompt - antes.prompt,
    completion: tokens.completion - antes.completion,
    razonamiento: tokens.razonamiento - antes.razonamiento,
    total: tokens.total - antes.total,
  };
  for (const k of ["prompt", "completion", "razonamiento", "total"] as const) {
    resumen.tokens[k] += gasto[k];
    if (estado === "ok") resumen.tokensOk[k] += gasto[k];
  }
  if (estado === "ok") resumen.ok++;
  else if (estado === "rechazo") resumen.rechazo++;
  else if (estado === "sin-fuente") resumen.sinFuente++;
  else resumen.error++;

  if (estado !== "ok") resumen.errores.push(`#${fila.id} ${fila.source_name}: ${estado} — ${err.slice(0, 160)}`);

  aseguraDir(salida);
  appendFileSync(
    salida,
    `${JSON.stringify({ id: fila.id, source: fila.source_name, url: fila.source_url, estado, titulo, err: err.slice(0, 300), tokens: gasto })}\n`
  );

  const c = coste(gasto);
  console.log(
    `[${resumen.total}/${filas.length}] #${fila.id} ${estado.padEnd(9)} ` +
      `${gasto.total.toString().padStart(6)} tok ` +
      `(raz ${gasto.razonamiento})  ${c.offpeak < 0.01 ? "<1c" : "$" + c.offpeak.toFixed(3)}  ` +
      (titulo || fila.source_title).slice(0, 60)
  );
}

console.log("\n--- Resumen ---");
console.log(`Notas:        ${resumen.total}`);
console.log(`Buenas:       ${resumen.ok}`);
console.log(`Rechazadas:   ${resumen.rechazo}`);
console.log(`Sin fuente:   ${resumen.sinFuente}`);
console.log(`Con error:    ${resumen.error}`);
if (resumen.errores.length) {
  console.log("\nErrores:");
  for (const e of resumen.errores.slice(0, 15)) console.log(`  - ${e}`);
}

const t = resumen.tokens;
const tok = resumen.tokensOk;
console.log("\nTokens gastados (todo, incl. intentos fallidos):");
console.log(`  entrada: ${t.prompt.toLocaleString()}   salida: ${t.completion.toLocaleString()}   (razonamiento: ${t.razonamiento.toLocaleString()})   total: ${t.total.toLocaleString()}`);
if (resumen.ok) {
  const cTot = coste(t);
  const porOk = {
    prompt: tok.prompt / resumen.ok,
    completion: tok.completion / resumen.ok,
    total: tok.total / resumen.ok,
  };
  const cOk = coste(porOk);
  console.log("\nPor nota buena (media de tokens):");
  console.log(`  entrada: ${porOk.prompt.toFixed(0)}   salida: ${porOk.completion.toFixed(0)}   total: ${porOk.total.toFixed(0)}`);
  console.log(`  coste/nota (solo tokens de notas buenas): off-peak ~$${cOk.offpeak.toFixed(4)}   peak ~$${cOk.peak.toFixed(4)}`);
  console.log(`  coste/nota (repartiendo el total real de la prueba): off-peak ~$${(cTot.offpeak / resumen.ok).toFixed(4)}   peak ~$${(cTot.peak / resumen.ok).toFixed(4)}`);
  console.log("\nTotal gastado en esta prueba:");
  console.log(`  off-peak ~$${cTot.offpeak.toFixed(4)}   peak ~$${cTot.peak.toFixed(4)}`);
}

console.log(`\nDetalle: ${salida}`);
console.log(`Buenas (cuerpo entero): ${okFile}`);

await closePool();
