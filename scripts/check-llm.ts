/**
 * Comprueba que la clave y el proveedor del modelo funcionan, sin tocar la
 * base de datos ni los feeds. Una llamada corta y barata.
 *
 *   npm run check:llm
 */
import "dotenv/config";
import { chat, parseJsonLoose, LlmError } from "../src/lib/llm";
import { env } from "../src/lib/env";

let clave: string;
try {
  clave = env.llmKey;
} catch {
  console.error("No hay clave: define LLM_API_KEY en el .env.");
  console.error("Se saca gratis en https://console.groq.com/keys");
  process.exit(1);
}

console.log(`Proveedor: ${env.llmBaseUrl}`);
console.log(`Modelo:    ${env.llmModel}`);
console.log(`Clave:     ${clave.slice(0, 6)}…${clave.slice(-4)}`);
console.log();

try {
  const raw = await chat({
    messages: [
      { role: "system", content: 'Responde solo con JSON: {"ok": true, "idioma": "..."}' },
      { role: "user", content: "Contesta en espanol e indica en que idioma respondes." },
    ],
    json: true,
    maxTokens: 100,
  });
  const parsed = parseJsonLoose<{ ok?: boolean; idioma?: string }>(raw);
  console.log(`Respuesta: ${JSON.stringify(parsed)}`);
  console.log("\nTodo correcto: el modelo responde y devuelve JSON valido.");
} catch (err) {
  const status = err instanceof LlmError ? err.status : undefined;
  console.error(`\nFallo: ${err instanceof Error ? err.message : String(err)}`);
  if (status === 401 || status === 403) {
    console.error("La clave es invalida o esta revocada. Revisa LLM_API_KEY en el .env.");
  } else if (status === 404) {
    console.error("Ese modelo no existe en este proveedor. Revisa LLM_MODEL y LLM_BASE_URL.");
  } else if (status === 429) {
    console.error("Cuota o limite de peticiones agotado. Prueba de nuevo en un rato.");
  }
  process.exitCode = 1;
}
