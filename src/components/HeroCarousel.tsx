"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/repo";
import { categoryName } from "@/lib/categories";
import { formatDate, formatViews } from "@/lib/format";

const INTERVALO = 7000;

export default function HeroCarousel({ articulos }: { articulos: Article[] }) {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = articulos.length;
  const contenedor = useRef<HTMLDivElement>(null);

  const ir = useCallback(
    (i: number) => setActual(((i % total) + total) % total),
    [total]
  );

  useEffect(() => {
    if (pausado || total < 2) return;
    // Con animaciones reducidas el carrusel no gira solo: el lector decide.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const t = setInterval(() => setActual((i) => (i + 1) % total), INTERVALO);
    return () => clearInterval(t);
  }, [pausado, total]);

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") { e.preventDefault(); ir(actual - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); ir(actual + 1); }
  }

  if (total === 0) return null;

  return (
    <div
      ref={contenedor}
      className="group/car relative overflow-hidden"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={() => setPausado(false)}
      onKeyDown={teclas}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Noticias destacadas"
      tabIndex={0}
    >
      <div className="scanline" aria-hidden="true" />

      {/* Pista: se desplaza en horizontal, un panel por noticia. */}
      <div
        className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${actual * 100}%)` }}
      >
        {articulos.map((a, i) => (
          <article
            key={a.id}
            className="w-full shrink-0 p-6 sm:p-8 lg:p-10"
            aria-hidden={i !== actual}
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${total}`}
          >
            <Link
              href={`/noticia/${a.slug}`}
              className="group block"
              tabIndex={i === actual ? 0 : -1}
            >
              {a.image_url && (
                <div className="mb-6 overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.image_url}
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
                <span className="text-fg-faint">{categoryName(a.category)}</span>
              </div>

              <h2 className="text-2xl leading-[1.14] font-bold tracking-tight text-balance transition-colors group-hover:text-neon sm:text-3xl lg:text-[2.4rem]">
                {a.title}
              </h2>

              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-muted sm:text-base">
                {a.dek}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2.5 font-mono text-[11.5px] text-fg-faint">
                <time>{formatDate(a.published_at)}</time>
                <span className="opacity-40">·</span>
                <span>{a.reading_minutes} min</span>
                <span className="opacity-40">·</span>
                <span>{a.source_name}</span>
                {formatViews(a.views) && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{formatViews(a.views)}</span>
                  </>
                )}
              </div>
            </Link>
          </article>
        ))}
      </div>

      {total > 1 && (
        <>
          {/* Flechas: aparecen al acercar el raton, siempre alcanzables con teclado. */}
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            aria-label="Noticia anterior"
            className="absolute top-1/2 left-3 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-bg/80 text-fg-muted opacity-0 backdrop-blur transition-all hover:border-neon hover:text-neon focus-visible:opacity-100 group-hover/car:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => ir(actual + 1)}
            aria-label="Noticia siguiente"
            className="absolute top-1/2 right-3 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-bg/80 text-fg-muted opacity-0 backdrop-blur transition-all hover:border-neon hover:text-neon focus-visible:opacity-100 group-hover/car:opacity-100"
          >
            ›
          </button>

          {/* Indicadores: la barra se llena mientras dura la diapositiva. */}
          <div className="absolute bottom-4 left-6 flex items-center gap-2 sm:left-8 lg:left-10">
            {articulos.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ir a la noticia ${i + 1}`}
                aria-current={i === actual}
                className="group/dot h-1.5 rounded-full transition-all"
                style={{ width: i === actual ? 34 : 14 }}
              >
                <span
                  className={`block h-full w-full overflow-hidden rounded-full ${
                    i === actual ? "bg-line-strong" : "bg-line hover:bg-line-strong"
                  }`}
                >
                  {i === actual && (
                    <span
                      key={`${actual}-${pausado}`}
                      className="block h-full w-full origin-left rounded-full bg-neon motion-reduce:animate-none"
                      style={{
                        animation: pausado
                          ? "none"
                          : `llenar ${INTERVALO}ms linear forwards`,
                      }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
