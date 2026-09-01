/**
 * Ingesta manual desde la linea de comandos.
 *
 *   npm run ingest              -> ingesta normal (limite INGEST_MAX_PER_RUN)
 *   npm run ingest -- --max=3   -> solo 3 articulos nuevos
 *   npm run ingest -- --dry     -> no llama al modelo, solo lista que haria
 *   npm run ingest -- --source=2
 */
import "dotenv/config";
import { runIngest } from "../src/lib/ingest";
import { closePool } from "../src/lib/db";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const report = await runIngest({
  maxPerRun: flag("max") ? Number(flag("max")) : undefined,
  sourceId: flag("source") ? Number(flag("source")) : undefined,
  dryRun: args.includes("--dry"),
  onProgress: (msg) => console.log(`  ${msg}`),
});

console.log("\n--- Resumen ---");
console.log(`Vistas:       ${report.seen}`);
console.log(`Creadas:      ${report.created}`);
console.log(`Publicadas:   ${report.published}`);
console.log(`Repetidas:    ${report.duplicates}   (misma noticia en otro medio)`);
console.log(`Ya conocidas: ${report.skipped}   (misma URL, o sin texto suficiente)`);
console.log(`Caducadas:    ${report.stale}   (mas viejas que la ventana de frescura)`);
console.log(`Fallos:       ${report.failed}`);
if (report.errors.length) {
  console.log("\nErrores:");
  for (const e of report.errors) console.log(`  - ${e}`);
}

await closePool();
