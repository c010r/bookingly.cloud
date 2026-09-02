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
    <div className="border-b border-line bg-bg">
      <nav
        aria-label="Secciones"
        className="contenedor flex items-stretch gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {activas.map((c) => (
          <Link
            key={c.slug}
            href={`/categoria/${c.slug}`}
            className="etiqueta group flex shrink-0 items-baseline gap-1.5 border-b-2 border-transparent py-3.5 whitespace-nowrap text-fg-muted transition-colors hover:border-accent hover:text-fg"
          >
            {c.name}
            <span className="text-[0.625rem] font-medium tracking-normal text-fg-faint tabular-nums">
              {counts[c.slug]}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
