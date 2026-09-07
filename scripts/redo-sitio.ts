/**
 * Rehace TODAS las notas publicadas con el modelo del .env: vuelve a bajar el
 * original, lo reescribe (titulo incluido) y actualiza la fila en la base.
 * No cambia el slug: la URL de cada nota se conserva. Solo toca filas con
 * status 'published' y que no hayan sido escritas ya por el modelo objetivo.
 *
 * Si el original ya no se puede descargar (paywall, medio caido), se intenta
 * rescatar el texto desde las fuentes adicionales que cubren la misma noticia
 * (extra_sources). Si ninguna responde, la nota se BORRA y se apunta en el log.
 * Un error del modelo o un rechazo editorial NO borra nada: deja la nota como
 * estaba y se apunta para que puedas relanzar el script y reintentarla.
 *
 *   LLM_MODEL=deepseek-v4-flash:high npx tsx scripts/redo-sitio.ts --max=5
 *
 * Es reanudable: escribe un JSONL con cada nota resuelta y las ya resueltas
 * (ok/borrada) se saltan al relanzar. Los errores y rechazos no se marcan como
 * hechos, asi que un segundo pase los vuelve a intentar.
 */
import "dotenv/config";
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { query, closePool } from "../src/lib/db";
import { rewriteArticle, FueraDeFocoError } from "../src/lib/rewriter";
import { fetchArticleText } from "../src/lib/ingest";
import { env } from "../src/lib/env";
import { titleKey } from "../src/lib/dedupe";
import { usoDeSesion, reiniciarUsoSesion } from "../src/lib/llm";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];

const max = Number(flag("max") ?? 0);
const concurrency = Math.max(1, Number(flag("concurrency") ?? 4));
const salida = flag("salida") ?? "/tmp/redo-sitio.jsonl";
const MODELO = env.llmModels[0]?.nombre ?? "deepseek-v4-flash";

// Precios de deepseek-v4-flash (USD por 1M de tokens, sin cache en entrada).
const PRECIO_IN = { offpeak: 0.22, peak: 0.44 };
const PRECIO_OUT = { offpeak: 0.66, peak: 1.32 };

type Fila = {
  id: number;
  slug: string;
  source_name: string;
  source_url: string;
  source_title: string;
  source_published_at: Date | null;
  source_author: string | null;
  extra_sources: string;
  links: string;
  model: string | null;
};

type Candidata = { name: string; url: string; title: string };

function aseguraDir(p: string) {
  mkdirSync(dirname(p), { recursive: true });
}

function coste(t: { prompt: number; completion: number }) {
  return {
    offpeak: (t.prompt / 1e6) * PRECIO_IN.offpeak + (t.completion / 1e6) * PRECIO_OUT.offpeak,
    peak: (t.prompt / 1e6) * PRECIO_IN.peak + (t.completion / 1e6) * PRECIO_OUT.peak,
  };
}

/** Resueltas en un pase anterior (ok o borrada): no se vuelven a tocar. */
function hechas(): Set<number> {
  const out = new Set<number>();
  if (!existsSync(salida)) return out;
  for (const linea of readFileSync(salida, "utf8").split("\n")) {
    if (!linea.includes('"estado":')) continue;
    try {
      const o = JSON.parse(linea) as { id: number; estado: string };
      if (o.estado === "ok" || o.estado === "borrada") out.add(o.id);
    } catch {
      /* linea malformada de una corrida cortada: se ignora */
    }
  }
  return out;
}

function extraerExtras(fila: Fila): Candidata[] {
  try {
    const arr = JSON.parse(fila.extra_sources) as { name?: string; url?: string; title?: string }[];
    return arr
      .filter((e) => e && e.url && e.url !== fila.source_url)
      .map((e) => ({ name: e.name || "otra fuente", url: e.url!, title: e.title || fila.source_title }))
      .slice(0, 6);
  } catch {
    return [];
  }
}

/** Baja el texto de una candidata; null si no hay con que escribir. */
async function material(c: Candidata, fecha: Date | null) {
  const { text, links } = await fetchArticleText({
    title: c.title,
    link: c.url,
    summary: "",
    publishedAt: fecha,
    author: null,
    image: null,
    contentHtml: "",
  });
  if (text.trim().length < 200) return null;
  return { text, links };
}

async function obtenerMaterial(
  fila: Fila,
  fecha: Date | null
): Promise<{ origen: Candidata; text: string; links: Awaited<ReturnType<typeof fetchArticleText>>["links"] } | null> {
  const principal: Candidata = {
    name: fila.source_name,
    url: fila.source_url,
    title: fila.source_title,
  };
  for (const candidata of [principal, ...extraerExtras(fila)]) {
    try {
      const m = await material(candidata, fecha);
      if (m) return { origen: candidata, ...m };
    } catch {
      // medio que no responde: se prueba la siguiente candidata
    }
  }
  return null;
}

async function unaNota(fila: Fila) {
  const antes = usoDeSesion();
  const gasto = { prompt: 0, completion: 0, razonamiento: 0, total: 0 };
  const linea = (estado: string, err = "", titulo = "") => {
    for (const k of ["prompt", "completion", "razonamiento", "total"] as const) {
      gasto[k] = usoDeSesion()[k] - antes[k];
    }
    appendFileSync(salida, `${JSON.stringify({ id: fila.id, slug: fila.slug, estado, titulo, err: err.slice(0, 300), tokens: gasto })}\n`);
    const c = coste(gasto);
    console.log(
      `#${fila.id} ${estado.padEnd(8)} ${gasto.total.toString().padStart(6)} tok ` +
        `(raz ${gasto.razonamiento}) ${c.offpeak < 0.01 ? "<1c" : "$" + c.offpeak.toFixed(3)}  ` +
        (titulo || fila.source_title).slice(0, 70)
    );
    return estado;
  };

  try {
    const material_ = await obtenerMaterial(fila, fila.source_published_at);
    if (!material_) {
      await query(`DELETE FROM articles WHERE id = $1 AND status = 'published'`, [fila.id]);
      return linea("borrada", "el original y sus alternativas ya no se pueden descargar");
    }
    const enlaces = material_.links
      .concat(JSON.parse(fila.links ?? "[]") as { url: string; texto: string }[])
      .slice(0, 6);

    const r = await rewriteArticle({
      sourceTitle: material_.origen.title,
      sourceUrl: material_.origen.url,
      sourceName: material_.origen.name,
      content: material_.text,
      publishedAt: fila.source_published_at,
      enlaces,
    });

    // No se toca el slug ni la fecha de publicacion: la URL y el archivo viven.
    await query(
      `UPDATE articles
          SET title = $2, dek = $3, body_md = $4, tags = $5, category = $6,
              seo_title = $7, seo_description = $8,
              quality_score = $9, quality_notes = $10,
              links = $11::jsonb, model = $12, title_key = $13,
              reading_minutes = GREATEST(1, round(
                array_length(regexp_split_to_array(trim($4), '\\s+'), 1) / 200.0)::int),
              updated_at = now()
        WHERE id = $1 AND model IS DISTINCT FROM $12`,
      [
        fila.id,
        r.title,
        r.dek,
        r.bodyMd,
        r.tags,
        r.category,
        r.seoTitle,
        r.seoDescription,
        r.qualityScore,
        r.qualityNotes,
        JSON.stringify(r.enlaces),
        r.model,
        titleKey(r.title),
      ]
    );
    return linea("ok", "", r.title);
  } catch (e) {
    if (e instanceof FueraDeFocoError) {
      return linea("rechazo", e.motivo, "");
    }
    return linea("error", e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  const filas = await query<Fila>(
    `SELECT a.id, a.slug, a.source_name, a.source_url, a.source_title,
            a.source_published_at, a.source_author,
            COALESCE(a.extra_sources, '[]'::jsonb)::text AS extra_sources,
            COALESCE(a.links, '[]'::jsonb)::text AS links,
            a.model
       FROM articles a
      WHERE a.status = 'published'
        AND a.model IS DISTINCT FROM $1
      ORDER BY a.published_at DESC`,
    [MODELO]
  );
  const ya = hechas();
  const pendientes = filas.filter((f) => !ya.has(f.id));
  const lote = max > 0 ? pendientes.slice(0, max) : pendientes;
  const restantes = pendientes.length - lote.length;

  reiniciarUsoSesion();
  console.log(`Proveedor: ${env.llmBaseUrl}`);
  console.log(`Modelo:    ${env.llmModels.map((m) => (m.esfuerzo ? `${m.nombre}:${m.esfuerzo}` : m.nombre)).join(", ")}`);
  console.log(`Publicadas con otro modelo: ${pendientes.length}  (${ya.size} ya resueltas antes)`);
  console.log(`Este pase reescribe ${lote.length}${restantes ? `, deja ${restantes} para otro pase` : ""}`);
  console.log(`Salida:    ${salida}`);
  console.log();

  const resumen = { ok: 0, borrada: 0, rechazo: 0, error: 0 };

  let indice = 0;
  async function trabajador() {
    while (true) {
      const i = indice++;
      const fila = lote[i];
      if (!fila) return;
      const r = await unaNota(fila);
      if (r === "ok") resumen.ok++;
      else if (r === "borrada") resumen.borrada++;
      else if (r === "rechazo") resumen.rechazo++;
      else resumen.error++;
      process.stdout.write(`  [${Math.min(i + 1, lote.length)}/${lote.length}]`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, trabajador));

  const uso = usoDeSesion();
  const tot = { prompt: uso.prompt, completion: uso.completion, total: uso.total, razonamiento: uso.razonamiento };
  const cTot = coste(tot);
  console.log("\n--- Resumen de este pase ---");
  console.log(`Intentadas:  ${lote.length}`);
  console.log(`Reescritas:  ${resumen.ok}`);
  console.log(`Borradas:    ${resumen.borrada} (original y alternativas inaccesibles)`);
  console.log(`Rechazadas:  ${resumen.rechazo} (fuera de foco; quedan como estaban)`);
  console.log(`Con error:   ${resumen.error} (quedan como estaban; relanza para reintentar)`);
  console.log(`Tokens:      ${tot.total.toLocaleString()}  (entrada ${tot.prompt.toLocaleString()} · salida ${tot.completion.toLocaleString()}, raz ${tot.razonamiento.toLocaleString()})`);
  if (lote.length) {
    console.log(`Coste pase:  off-peak ~$${cTot.offpeak.toFixed(4)}   peak ~$${cTot.peak.toFixed(4)}`);
  }
  console.log(`\nDetalle: ${salida}`);
  await closePool();
}

aseguraDir(salida);
main().catch(async (e) => {
  console.error(e);
  await closePool();
  process.exit(1);
});
