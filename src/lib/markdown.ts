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
