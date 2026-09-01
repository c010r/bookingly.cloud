import { createHash } from "node:crypto";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Huella estable de la noticia original, para no reescribir dos veces lo mismo. */
export function fingerprint(sourceUrl: string): string {
  const normalized = sourceUrl
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
  return createHash("sha1").update(normalized).digest("hex");
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
