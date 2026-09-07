/**
 * Compara low vs medium sobre las MISMAS notas reales: lee los resultados del
 * piloto (low) guardados en /tmp/pilot-coste.jsonl y /tmp/pilot-coste-ok.jsonl,
 * vuelve a bajar cada original y lo reescribe con el modelo del .env (medium).
 * Solo gasta el pase de medium: los numeros de low ya estan medidos.
 *
 *   npx tsx scripts/compara-esfuerzos.ts
 */
import "dotenv/config";
import { appendFileSync, readFileSync } from "node:fs";
import { fetchArticleText } from "../src/lib/ingest";
import { rewriteArticle } from "../src/lib/rewriter";
import { env } from "../src/lib/env";
import { usoDeSesion, reiniciarUsoSesion } from "../src/lib/llm";

const PRECIO_IN = { offpeak: 0.22, peak: 0.44 };
const PRECIO_OUT = { offpeak: 0.66, peak: 1.32 };
const coste = (t: { prompt: number; completion: number }) =>
  (t.prompt / 1e6) * PRECIO_IN.offpeak + (t.completion / 1e6) * PRECIO_OUT.offpeak;

type Detalle = {
  id: number;
  estado: string;
  tokens: { prompt: number; completion: number; razonamiento: number; total: number };
};

const detalleLow = readFileSync("/tmp/pilot-coste.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Detalle);

const filas = readFileSync("/tmp/pilot-coste-ok.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as { id: number; source_name: string; source_url: string; source_title: string; source_published_at: string | null; links: string | null; rewrite: { qualityScore: number; model: string } });

const lowPorId = new Map(detalleLow.filter((d) => d.estado === "ok").map((d) => [d.id, d]));
const okFile = "/tmp/compara-medium.jsonl";

reiniciarUsoSesion();
console.log(`Reescribiendo a ${env.llmModel} (${env.llmBaseUrl}) las mismas notas del piloto low...`);
console.log();

for (const f of filas) {
  const low = lowPorId.get(f.id);
  if (!low) continue;
  const antes = usoDeSesion();
  let estado = "error";
  let err = "";
  let calidad = 0;
  let titulo = "";
  try {
    const { text, links } = await fetchArticleText({
      title: f.source_title,
      link: f.source_url,
      summary: "",
      publishedAt: f.source_published_at ? new Date(f.source_published_at) : null,
      author: null,
      image: null,
      contentHtml: "",
    });
    if (text.trim().length < 200) {
      estado = "sin-fuente";
      err = "ya no se descarga";
    } else {
      const enlaces = links
        .concat(JSON.parse(f.links ?? "[]") as { url: string; texto: string }[])
        .slice(0, 6);
      const r = await rewriteArticle({
        sourceTitle: f.source_title,
        sourceUrl: f.source_url,
        sourceName: f.source_name,
        content: text,
        publishedAt: f.source_published_at ? new Date(f.source_published_at) : null,
        enlaces,
      });
      estado = "ok";
      calidad = r.qualityScore;
      titulo = r.title;
    }
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  const despues = usoDeSesion();
  const gasto = {
    prompt: despues.prompt - antes.prompt,
    completion: despues.completion - antes.completion,
    razonamiento: despues.razonamiento - antes.razonamiento,
    total: despues.total - antes.total,
  };
  appendFileSync(
    okFile,
    `${JSON.stringify({ id: f.id, estado, titulo, err: err.slice(0, 200), calidad, tokens: gasto })}\n`
  );

  const c = coste(gasto);
  console.log(
    `#${f.id} low ${String(low.tokens.total).padStart(6)} tok q=${String(f.rewrite.qualityScore).padStart(3)} ` +
      `| med ${String(gasto.total).padStart(6)} tok q=${String(calidad).padStart(3)} ` +
      `raz ${gasto.razonamiento} $${c.toFixed(4)}  ${(titulo || f.source_title).slice(0, 50)}`
  );
}

console.log("\nDetalle medium: " + okFile);
