import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { categoryCounts } from "@/lib/repo";

/**
 * Navegacion por secciones. Solo muestra las categorias que ya tienen
 * noticias publicadas, para no ofrecer al lector secciones vacias.
 */
export default async function SiteNav() {
  let counts: Record<string, number> = {};
  try {
    counts = await categoryCounts();
  } catch {
    // Sin base de datos todavia: la cabecera sigue funcionando.
    return null;
  }

  const active = CATEGORIES.filter((c) => (counts[c.slug] ?? 0) > 0);
  if (active.length === 0) return null;

  return (
    <div className="subnav">
      <div className="wrap inner">
        {active.map((c) => (
          <Link key={c.slug} href={`/categoria/${c.slug}`}>
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
