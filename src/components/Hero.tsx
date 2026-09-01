import Link from "next/link";
import type { Article } from "@/lib/repo";
import HeroCarousel from "./HeroCarousel";
import { formatRelative } from "@/lib/format";

/**
 * Portada: la noticia principal a la izquierda y, a la derecha, dos columnas
 * de apoyo — lo ultimo en entrar y lo mas leido de la semana.
 */
export default function Hero({
  destacadas,
  recientes,
  masLeidas,
}: {
  destacadas: Article[];
  recientes: Article[];
  masLeidas: Article[];
}) {
  const tope = Math.max(...masLeidas.map((a) => a.views), 1);

  return (
    <section className="relative mt-6 mb-14 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid gap-px bg-line lg:grid-cols-[1.55fr_1fr]">
        {/* min-w-0 es imprescindible: la pista del carrusel mide 500% y, como
            los elementos de una rejilla se dimensionan por su contenido
            minimo, sin esto la columna se expande y expulsa a la de al lado. */}
        <div className="min-w-0 overflow-hidden bg-surface">
          <HeroCarousel articulos={destacadas} />
        </div>

        {/* --- Columnas de apoyo --- */}
        <div className="grid min-w-0 gap-px bg-line">
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
