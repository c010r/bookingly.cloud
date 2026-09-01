/** Prueba rapida de los helpers puros: no toca red, ni base de datos, ni DeepSeek. */
import { renderMarkdown, excerpt } from "../src/lib/markdown";
import { slugify, fingerprint, readingMinutes } from "../src/lib/slug";
import { parseJsonLoose } from "../src/lib/deepseek";
import { similarity, titleKey, normalizeTitle } from "../src/lib/dedupe";
import { normalizeCategory } from "../src/lib/categories";

let fallos = 0;
function check(nombre: string, ok: boolean, extra = "") {
  console.log(`${ok ? "ok  " : "FALLA"} ${nombre}${extra ? `  ${extra}` : ""}`);
  if (!ok) fallos++;
}

/* --- markdown --- */
const md = [
  "## Que ha pasado",
  "",
  "OpenAI **anuncio** algo. Y <script>alert(1)</script> aqui.",
  "",
  "- uno",
  "- dos",
  "",
  "[enlace](https://ejemplo.com)",
].join("\n");

const html = renderMarkdown(md);
check("elimina <script>", !html.includes("<script"));
check("enlace con rel nofollow", html.includes('rel="nofollow noopener"'));
check("mantiene la estructura", html.includes("<h2>") && html.includes("<li>"));
check("excerpt sin markdown", !excerpt(md).includes("##"));

/* --- slugs --- */
check("slug con tildes", slugify("Como la IA esta cambiando Espana") === "como-la-ia-esta-cambiando-espana");
check(
  "slug normaliza acentos",
  slugify("Cómo la IA está cambiando España") === "como-la-ia-esta-cambiando-espana",
  slugify("Cómo la IA está cambiando España")
);
check(
  "fingerprint ignora utm y mayusculas",
  fingerprint("https://a.com/x/?utm=1") === fingerprint("https://A.com/x")
);
check("minutos de lectura", readingMinutes(new Array(420).fill("palabra").join(" ")) === 2);

/* --- json del modelo --- */
check(
  "json entre vallas",
  parseJsonLoose<{ titular: string }>('```json\n{"titular":"hola"}\n```').titular === "hola"
);
check("json con ruido alrededor", parseJsonLoose<{ a: number }>('Claro:\n{"a":1}\nEso es todo.').a === 1);

/* --- deduplicacion --- */
const t1 = "Apple compra la startup de IA Brighter AI por 200 millones";
const t2 = "Apple adquiere Brighter AI, una startup de inteligencia artificial, por 200 millones";
const t3 = "Nvidia presenta su nueva GPU para centros de datos";
const t4 = "Apple buys AI startup Brighter AI for $200 million";

check("misma noticia reformulada", similarity(t1, t2) > 0.42, similarity(t1, t2).toFixed(2));
check("noticias distintas", similarity(t1, t3) < 0.42, similarity(t1, t3).toFixed(2));
check("titular identico", similarity(t1, t1) > 0.9, similarity(t1, t1).toFixed(2));
check(
  "titleKey ignora orden y stopwords",
  titleKey("El nuevo chip de Apple") === titleKey("Chip nuevo de Apple")
);
check("normalizeTitle limpia signos", normalizeTitle("¿Que pasa, Apple?") === "que pasa apple");
console.log(`     (info) es vs en: ${similarity(t1, t4).toFixed(2)} — el ingles baja el solape lexico`);

/* --- categorias --- */
check("categoria valida", normalizeCategory("ia") === "ia");
check("categoria por nombre", normalizeCategory("Ciberseguridad") === "ciberseguridad");
check("categoria invalida cae al defecto", normalizeCategory("marketing") === "software");

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobaciones fallidas.`);
process.exit(fallos === 0 ? 0 : 1);
