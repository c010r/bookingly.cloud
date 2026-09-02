/**
 * Comprueba que la clave y los modelos funcionan, y muestra cuales estan
 * apartados por haber agotado su cupo. Una llamada corta y barata.
 *
 *   npm run check:llm
 */
import "dotenv/config";
import { chat, parseJsonLoose, LlmError } from "../src/lib/llm";
import { env } from "../src/lib/env";
import { query, closePool } from "../src/lib/db";

let clave: string;
try {
  clave = env.llmKey;
} catch {
  console.error("No hay clave: define LLM_API_KEY en el .env.");
  console.error("Se saca gratis en https://console.groq.com/keys");
  process.exit(1);
}

console.log(`Proveedor: ${env.llmBaseUrl}`);
const listado = env.llmModels.map((m) => (m.esfuerzo ? `${m.nombre}:${m.esfuerzo}` : m.nombre));
console.log(`Modelos:   ${listado.join(", ")}`);
console.log(`Clave:     ${clave.slice(0, 6)}…${clave.slice(-4)}`);

// Que modelos estan en pausa ahora mismo y hasta cuando.
try {
  const pausas = await query<{ model: string; reason: string; minutos: number }>(
    `SELECT model, reason, ceil(extract(epoch from (until - now())) / 60) AS minutos
       FROM llm_cooldowns WHERE until > now() ORDER BY until`
  );
  if (pausas.length > 0) {
    console.log("\nEn pausa:");
    for (const p of pausas) {
      console.log(`  ${p.model} — ${p.reason}, vuelve en ${p.minutos} min`);
    }
  }
} catch {
  console.log("(sin base de datos: no se puede consultar que modelos estan en pausa)");
}

console.log();

try {
  const respuesta = await chat({
    messages: [
      { role: "system", content: 'Responde solo con JSON: {"ok": true, "idioma": "..."}' },
      { role: "user", content: "Contesta en espanol e indica en que idioma respondes." },
    ],
    json: true,
    // Holgado a proposito: un modelo con razonamiento gasta tokens pensando
    // antes de escribir, y si se queda sin cupo devuelve el contenido vacio.
    maxTokens: 2000,
  });
  const parsed = parseJsonLoose<{ ok?: boolean; idioma?: string }>(respuesta.content);
  console.log(`Respondio ${respuesta.model}: ${JSON.stringify(parsed)}`);
  console.log("\nTodo correcto: el modelo responde y devuelve JSON valido.");
} catch (err) {
  const status = err instanceof LlmError ? err.status : undefined;
  console.error(`\nFallo: ${err instanceof Error ? err.message : String(err)}`);
  if (status === 401 || status === 403) {
    console.error("La clave es invalida o esta revocada. Revisa LLM_API_KEY en el .env.");
  } else if (status === 404) {
    console.error("Ningun modelo de la lista existe en este proveedor. Revisa LLM_MODEL.");
  } else if (status === 429) {
    console.error("Todos los modelos agotaron su cupo. Vuelve a probar mas tarde.");
  }
  process.exitCode = 1;
}

await closePool();
