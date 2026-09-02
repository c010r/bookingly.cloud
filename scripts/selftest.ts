/** Prueba rapida de los helpers puros: no toca red, ni base de datos, ni el modelo. */
import { renderMarkdown, excerpt } from "../src/lib/markdown";
import { slugify, fingerprint, readingMinutes } from "../src/lib/slug";
import { formatViews } from "../src/lib/format";
import { empiezaConSigla } from "../src/lib/markdown";
import { parseJsonLoose } from "../src/lib/llm";
import { similarity, titleKey, normalizeTitle, UMBRAL_DUPLICADO } from "../src/lib/dedupe";
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

check("vistas: cero tambien se muestra", formatViews(0) === "0 vistas" && formatViews(null) === "0 vistas");
check("vistas: singular", formatViews(1) === "1 vista", formatViews(1));
// En espanol las cifras de cuatro digitos van sin separador; a partir de cinco,
// con punto. Lo hace toLocaleString y conviene fijarlo para que no sorprenda.
check("vistas: cuatro digitos sin separador", formatViews(1234) === "1234 vistas", formatViews(1234));
check("vistas: cinco digitos con punto", formatViews(12345) === "12.345 vistas", formatViews(12345));

/* --- json del modelo --- */
check(
  "json entre vallas",
  parseJsonLoose<{ titular: string }>('```json\n{"titular":"hola"}\n```').titular === "hola"
);
check("json con ruido alrededor", parseJsonLoose<{ a: number }>('Claro:\n{"a":1}\nEso es todo.').a === 1);

/* --- capitular --- */
check("sigla: no lleva capitular", empiezaConSigla("AEREDIUM lanza AERSeal para todos."));
check("palabra normal: si lleva", !empiezaConSigla("Google cierra su servicio de fotos."));
check(
  "se salta el titulo previo",
  empiezaConSigla("## Que ha pasado\n\nNASA firma con Blue Origin.")
);
check("nombre con mayuscula suelta", !empiezaConSigla("Apple compra una startup de IA."));

/* --- deduplicacion --- */
const t1 = "Apple compra la startup de IA Brighter AI por 200 millones";
const t2 = "Apple adquiere Brighter AI, una startup de inteligencia artificial, por 200 millones";
const t3 = "Nvidia presenta su nueva GPU para centros de datos";
const t4 = "Apple buys AI startup Brighter AI for $200 million";

const U = UMBRAL_DUPLICADO;
check("misma noticia reformulada", similarity(t1, t2) > U, similarity(t1, t2).toFixed(2));
check("noticias distintas", similarity(t1, t3) < U, similarity(t1, t3).toFixed(2));
// La escala no llega a 1 sin codigo de producto; ver el comentario en similarity().
check("titular identico", similarity(t1, t1) > 0.65, similarity(t1, t1).toFixed(2));

/* Casos reales del 2 de septiembre de 2026: siete piezas del mismo lanzamiento
   de Poco se publicaron por separado porque la similitud se quedaba en 0.28-0.40
   contra un umbral de 0.42. Estos son los pares mas dificiles de aquel grupo. */
const poco = [
  "Poco lanza el F9 Pro y el F9 Ultra con pantallas de 185Hz y enormes baterias",
  "Poco F9 Ultra y F9 Pro: bateria enorme, subwoofer Bose y zoom 5x",
  "Poco F9 Ultra y F9 Pro: bateria de 8.050 mAh, camara de 200 MP y hasta 185 FPS",
  "POCO F9 Pro: tres dias con un flagship que apunta mas alla del gaming",
  "POCO F9 Ultra: el primer movil con subwoofer que se oye de verdad",
  "Poco F9 Pro llega con Snapdragon 8 Elite Gen 5 V Series y precio mas bajo",
  "Poco F9 Ultra y Pro: salto a la gama alta con 100 W y camaras de 200 MP",
];
for (let i = 1; i < poco.length; i++) {
  const mejor = Math.max(...poco.slice(0, i).map((otro) => similarity(poco[i], otro)));
  check(`mismo lanzamiento Poco F9 (pieza ${i + 1})`, mejor >= U, mejor.toFixed(2));
}

/* Y los falsos positivos que hay que seguir rechazando: mismo protagonista o
   misma plataforma, noticias distintas. */
const falsos: [string, string][] = [
  [
    "Sony lanza Live TV on PS5 con mas de 100 canales gratis",
    "CD Projekt Red no garantiza disco de Witcher 4 en PS5",
  ],
  [
    "CD Projekt Red regala el remaster de The Witcher 3",
    "CD Projekt confiesa que no puede hacer nada por The Witcher 4 en disco",
  ],
  [
    "GTA 6 cambiara el esprint: adios a machacar la X",
    "GTA 6 iba a tener supermercados con nevera que se rellena sola",
  ],
];
for (const [a, b] of falsos) {
  const s = similarity(a, b);
  check(`no confunde: ${a.slice(0, 26)}...`, s < U, s.toFixed(2));
}
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
