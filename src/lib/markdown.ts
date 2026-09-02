import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: false });

/**
 * El cuerpo lo genera nuestro propio modelo, pero igualmente pasa por un
 * allowlist: nunca renderizamos HTML arbitrario venido de un LLM.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote",
      "strong", "em", "code", "pre", "a", "br", "hr", "table",
      "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
      // Un LLM despistado puede devolver h1; lo bajamos para no romper la jerarquia.
      h1: "h2",
    },
  });
}

export function excerpt(md: string, length = 180): string {
  const plain = md
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? `${plain.slice(0, length).trimEnd()}...` : plain;
}

/**
 * La capitular parte la primera palabra, y con una sigla el resultado se lee
 * mal: un articulo que empieza por "AEREDIUM" queda como "A EREDIUM". Se
 * detecta mirando si las dos primeras letras van en mayuscula, que es lo que
 * distingue una sigla de una palabra normal.
 */
export function empiezaConSigla(md: string): boolean {
  const primerParrafo = md
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    // Nos saltamos titulos, citas y listas: la capitular cae en el primer parrafo.
    .find((b) => b && !/^(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```)/.test(b));
  if (!primerParrafo) return false;
  // Fuera el enfasis de markdown y cualquier signo de apertura.
  const limpio = primerParrafo.replace(/^[^\p{L}\p{N}]+/u, "");
  const dos = limpio.slice(0, 2);
  return dos.length === 2 && dos === dos.toUpperCase() && /^\p{Lu}{2}$/u.test(dos);
}
