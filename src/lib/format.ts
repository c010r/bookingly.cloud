/** Formatos de fecha compartidos entre servidor y cliente. */

export function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "hace 5 min", "hace 3 h", "ayer"... para listados de actualidad. */
export function formatRelative(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const min = Math.round((Date.now() - date.getTime()) / 60000);

  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;

  const horas = Math.round(min / 60);
  if (horas < 24) return `${horas} h`;

  const dias = Math.round(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `${dias} d`;

  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * "1.234 vistas". Devuelve cadena vacia cuando no hay ninguna: una nota recien
 * publicada mostrando "0 vistas" parece rota, y ademas quien la lee primero
 * veria un cero, porque el contador se incrementa despues de pintar la pagina.
 */
export function formatViews(n: number | null | undefined): string {
  if (!n || n < 1) return "";
  return `${n.toLocaleString("es-ES")} ${n === 1 ? "vista" : "vistas"}`;
}
