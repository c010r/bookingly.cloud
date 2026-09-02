import { getLastUpdate } from "@/lib/repo";

/** Sello de ultima publicacion, siempre en UTC para que no dependa del lector. */
function formatUtc(d: Date): string {
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export default async function LastUpdate() {
  let ultima: Date | null = null;
  try {
    ultima = await getLastUpdate();
  } catch {
    return null; // Sin base de datos, el pie sigue funcionando.
  }
  if (!ultima) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 bg-accent" />
      <span>
        Ultima actualizacion:{" "}
        <time dateTime={ultima.toISOString()}>{formatUtc(ultima)}</time>
      </span>
    </span>
  );
}
