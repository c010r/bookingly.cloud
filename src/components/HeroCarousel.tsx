"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Article } from "@/lib/repo";
import { categoryName } from "@/lib/categories";
import { formatDate, formatViews, isoDate } from "@/lib/format";
import PortadaGenerica from "./PortadaGenerica";

const INTERVALO = 7000;

/**
 * Apertura de portada. Cada diapositiva ocupa el ancho de la ventana: el
 * titular a la izquierda, alineado con el canalon del contenedor, y la imagen
 * a sangre por la derecha.
 */
export default function HeroCarousel({ articulos }: { articulos: Article[] }) {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = articulos.length;

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
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      ir(actual - 1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      ir(actual + 1);
    }
  }

  if (total === 0) return null;

  return (
    <div
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={() => setPausado(false)}
      onKeyDown={teclas}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Noticias destacadas"
    >
      {/* Pista: se desplaza en horizontal, una diapositiva por noticia. */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(-${actual * 100}%)` }}
        >
          {articulos.map((a, i) => (
            <article
              key={a.id}
              className="grupo-pieza group w-full min-w-0 shrink-0"
              aria-hidden={i !== actual}
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
            >
              <Link
                href={`/noticia/${a.slug}`}
                className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)]"
                tabIndex={i === actual ? 0 : -1}
              >
                {/* Imagen: banda a sangre arriba en movil, columna derecha
                    de altura completa a partir de lg. */}
                <div className="relative order-1 h-[62vw] max-h-[24rem] min-h-[13rem] overflow-hidden bg-surface-2 lg:order-2 lg:h-auto lg:max-h-none lg:min-h-[33rem]">
                  {a.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      // Varios CDN devuelven 403 si el referer es otro dominio; sin el sirven igual.
                      referrerPolicy="no-referrer"
                      src={a.image_url}
                      alt=""
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <PortadaGenerica
                      categoria={a.category}
                      className="absolute inset-0"
                      grosor={3}
                    />
                  )}
                </div>

                <div className="canalon-inicio order-2 flex min-w-0 flex-col justify-center py-8 pr-5 lg:order-1 lg:py-14 lg:pr-14">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="etiqueta bg-accent px-2 py-1 text-accent-fg">
                      En portada
                    </span>
                    <span className="etiqueta text-fg-muted">
                      {categoryName(a.category)}
                    </span>
                  </div>

                  <h2 className="enlace-titular titular-xxl mt-5">{a.title}</h2>

                  {a.dek && (
                    <p className="entradilla mt-5 max-w-xl text-lg text-fg-muted sm:text-xl">
                      {a.dek}
                    </p>
                  )}

                  <div className="meta mt-7 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-fg-faint">
                    <time dateTime={isoDate(a.published_at)}>
                      {formatDate(a.published_at)}
                    </time>
                    <span aria-hidden="true" className="text-fg-faint/50">
                      /
                    </span>
                    <span>{a.reading_minutes} min</span>
                    <span aria-hidden="true" className="text-fg-faint/50">
                      /
                    </span>
                    <span>
                      {a.extra_sources?.length
                        ? `${a.extra_sources.length + 1} fuentes`
                        : a.source_name}
                    </span>
                    <span aria-hidden="true" className="text-fg-faint/50">
                      /
                    </span>
                    <span>{formatViews(a.views)}</span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>

      {total > 1 && (
        <div className="border-t border-line">
          <div className="canalon-inicio flex items-center gap-3 pr-5 lg:pr-10">
            {/* Sumario numerado: 01 a 05, con la barra de avance de la activa. */}
            <div className="flex flex-1 items-end gap-2 py-3 sm:gap-4">
              {articulos.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => ir(i)}
                  aria-label={`Ir a la noticia ${i + 1}: ${a.title}`}
                  aria-current={i === actual}
                  className="group/n w-full max-w-[6.5rem] flex-1 text-left"
                >
                  <span
                    className={`meta block font-bold transition-colors ${
                      i === actual
                        ? "text-accent"
                        : "text-fg-faint group-hover/n:text-fg"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1.5 block h-[3px] w-full overflow-hidden bg-line">
                    {i === actual && (
                      <span
                        key={`${actual}-${pausado}`}
                        className="block h-full w-full origin-left bg-accent motion-reduce:animate-none"
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

            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => ir(actual - 1)}
                aria-label="Noticia anterior"
                className="grid h-9 w-9 place-items-center border border-line text-fg-muted transition-colors hover:border-accent hover:bg-accent hover:text-accent-fg"
              >
                <span aria-hidden="true">&#8592;</span>
              </button>
              <button
                type="button"
                onClick={() => ir(actual + 1)}
                aria-label="Noticia siguiente"
                className="-ml-px grid h-9 w-9 place-items-center border border-line text-fg-muted transition-colors hover:border-accent hover:bg-accent hover:text-accent-fg"
              >
                <span aria-hidden="true">&#8594;</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
