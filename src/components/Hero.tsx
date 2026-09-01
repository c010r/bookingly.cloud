import Link from "next/link";
import type { Article } from "@/lib/repo";
import { excerpt } from "@/lib/markdown";
import { categoryName } from "@/lib/categories";
import { formatDate, formatRelative } from "@/lib/format";

/**
 * Portada: la noticia principal a la izquierda y, a la derecha, dos columnas
 * de apoyo — lo ultimo en entrar y lo mas leido de la semana.
 */
export default function Hero({
  principal,
  recientes,
  masLeidas,
}: {
  principal: Article;
  recientes: Article[];
  masLeidas: Article[];
}) {
  const tope = Math.max(...masLeidas.map((a) => a.views), 1);

  return (
    <section className="relative mt-6 mb-14 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="scanline" aria-hidden="true" />

      <div className="grid gap-px bg-line lg:grid-cols-[1.55fr_1fr]">
        {/* --- Principal --- */}
        <article className="group relative bg-surface p-6 sm:p-8 lg:p-10">
          <Link href={`/noticia/${principal.slug}`} className="block">
            {principal.image_url && (
              <div className="mb-6 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={principal.image_url}
                  alt=""
                  className="aspect-[16/9] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em]">
              <span className="inline-flex items-center gap-1.5 text-neon">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon" />
                En portada
              </span>
              <span className="text-fg-faint">/</span>
              <span className="text-fg-faint">{categoryName(principal.category)}</span>
            </div>

            <h1 className="text-3xl leading-[1.12] font-bold tracking-tight text-balance transition-colors group-hover:text-neon sm:text-4xl lg:text-[2.6rem]">
              {principal.title}
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-muted sm:text-base">
              {principal.dek || excerpt(principal.body_md, 220)}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5 font-mono text-[11.5px] text-fg-faint">
              <time>{formatDate(principal.published_at)}</time>
              <span className="opacity-40">·</span>
              <span>{principal.reading_minutes} min</span>
              <span className="opacity-40">·</span>
              <span>{principal.source_name}</span>
            </div>
          </Link>
        </article>

        {/* --- Columnas de apoyo --- */}
        <div className="grid gap-px bg-line">
          <Panel titulo="Recien llegadas" acento="neon-2">
            <ol className="divide-y divide-line">
              {recientes.map((a, i) => (
                <li key={a.id} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link
                    href={`/noticia/${a.slug}`}
                    className="group flex gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="mt-0.5 font-mono text-[10.5px] text-neon-2 tabular-nums">
                      {formatRelative(a.published_at)}
                    </span>
                    <span className="flex-1 text-[13.5px] leading-snug font-medium transition-colors group-hover:text-neon-2">
                      {a.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel titulo="Mas leidas" acento="neon-3">
            <ol className="space-y-3.5">
              {masLeidas.map((a, i) => (
                <li key={a.id} className="rise" style={{ animationDelay: `${i * 60 + 120}ms` }}>
                  <Link href={`/noticia/${a.slug}`} className="group block">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-sm font-semibold text-neon-3 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-[13.5px] leading-snug font-medium transition-colors group-hover:text-neon-3">
                        {a.title}
                      </span>
                    </div>
                    {/* Barra proporcional a la mas leida del listado. */}
                    <div className="mt-1.5 ml-[2.1rem] h-[3px] overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="bar-fill h-full rounded-full bg-neon-3/70"
                        style={{
                          width: `${Math.max(6, Math.round((a.views / tope) * 100))}%`,
                          animationDelay: `${i * 90 + 200}ms`,
                        }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function Panel({
  titulo,
  acento,
  children,
}: {
  titulo: string;
  acento: "neon-2" | "neon-3";
  children: React.ReactNode;
}) {
  const color = acento === "neon-2" ? "text-neon-2" : "text-neon-3";
  return (
    <div className="bg-surface p-6 sm:p-7">
      <h2
        className={`caret mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${color}`}
      >
        {titulo}
      </h2>
      {children}
    </div>
  );
}
