import type { Metadata } from "next";
import Link from "next/link";
import { getTopTags } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Temas",
  description: "Todos los temas cubiertos por la redaccion.",
};

export default async function TemasPage() {
  const tags = await getTopTags(200);

  return (
    <>
      <div className="section-title">Todos los temas</div>
      {tags.length === 0 ? (
        <div className="empty">Aun no hay temas: publica alguna noticia primero.</div>
      ) : (
        <div className="tags">
          {tags.map((t) => (
            <Link key={t.tag} href={`/tema/${encodeURIComponent(t.tag)}`} className="tag">
              {t.tag} <span style={{ opacity: 0.5 }}>{t.n}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
