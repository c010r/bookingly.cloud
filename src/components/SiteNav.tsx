import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { categoryCounts } from "@/lib/repo";

/** Secciones con contenido. Las vacias no se ofrecen al lector. */
export default async function SiteNav() {
  let counts: Record<string, number> = {};
  try {
    counts = await categoryCounts();
  } catch {
    return null; // Sin base de datos, la cabecera sigue funcionando.
  }

  const activas = CATEGORIES.filter((c) => (counts[c.slug] ?? 0) > 0);
  if (activas.length === 0) return null;

  return (
    /* Diez secciones no caben en una linea. Antes la fila se desplazaba en
       horizontal con la barra oculta, asi que las ultimas quedaban cortadas sin
       ninguna pista de que siguieran ahi. Ahora de tableta hacia arriba se reparten
       en las lineas que hagan falta, y en movil, donde envolver comeria media
       pantalla, se mantiene el desplazamiento pero con un degradado al borde
       que avisa de que hay mas. */
    <div className="relative border-b border-border-subtle bg-bg/95 backdrop-blur-xs">
      <nav
        aria-label="Secciones"
        className="contenedor flex items-center gap-2 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <span className="hidden lg:inline text-[0.6875rem] font-bold uppercase tracking-wider text-fg-faint/80 shrink-0 mr-1">
          Secciones:
        </span>
        {activas.map((c) => (
          <Link
            key={c.slug}
            href={`/categoria/${c.slug}`}
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2/60 px-3 py-1 text-xs font-medium text-fg-muted transition-all hover:border-accent hover:bg-surface hover:text-fg hover:shadow-xs"
          >
            <span>{c.name}</span>
            <span className="rounded-full bg-bg px-1.5 py-0.2 text-[0.625rem] font-semibold text-fg-faint tabular-nums border border-line/60 group-hover:text-accent group-hover:border-accent/30">
              {counts[c.slug]}
            </span>
          </Link>
        ))}
      </nav>

      {/* Degradado para indicar desplazamiento en móvil */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent md:hidden"
      />
    </div>
  );
}
