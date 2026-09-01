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
    <div className="border-b border-line bg-bg-soft/60">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {activas.map((c) => (
          <Link
            key={c.slug}
            href={`/categoria/${c.slug}`}
            className="group flex shrink-0 items-center gap-1.5 font-mono text-[12px] whitespace-nowrap text-fg-muted transition-colors hover:text-neon"
          >
            {c.name}
            <span className="text-[10px] text-fg-faint tabular-nums transition-colors group-hover:text-neon">
              {counts[c.slug]}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
