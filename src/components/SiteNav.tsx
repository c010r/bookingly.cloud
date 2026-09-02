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
    <div className="relative border-b border-line bg-bg">
      <nav
        aria-label="Secciones"
        className="contenedor flex items-stretch gap-x-5 overflow-x-auto md:flex-wrap md:overflow-x-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {activas.map((c) => (
          <Link
            key={c.slug}
            href={`/categoria/${c.slug}`}
            className="etiqueta group flex shrink-0 items-baseline gap-1.5 border-b-2 border-transparent py-3.5 tracking-[0.08em] whitespace-nowrap text-fg-muted transition-colors hover:border-accent hover:text-fg"
          >
            {c.name}
            <span className="text-[0.625rem] font-medium tracking-normal text-fg-faint tabular-nums">
              {counts[c.slug]}
            </span>
          </Link>
        ))}
      </nav>

      {/* El degradado solo tiene sentido donde la fila se desplaza. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent md:hidden"
      />
    </div>
  );
}
