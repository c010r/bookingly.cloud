"use client";

import { useState } from "react";
import Link from "next/link";
import type { Article } from "@/lib/repo";
import { categoryName } from "@/lib/categories";
import { formatDate, formatRelative, formatViews, isoDate } from "@/lib/format";
import PortadaGenerica from "./PortadaGenerica";

export default function HeroBento({
  destacadas,
  recientes,
  masLeidas,
}: {
  destacadas: Article[];
  recientes: Article[];
  masLeidas: Article[];
}) {
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"recientes" | "masLeidas">("recientes");

  if (!destacadas || destacadas.length === 0) return null;
  const principal = destacadas[activeStoryIdx] || destacadas[0];
  const extraSourcesCount = principal.extra_sources?.length ?? 0;

  return (
    <section aria-label="Apertura destacada" className="contenedor pt-6 pb-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ===================================================================
            COLUMNA PRINCIPAL (Bento XL): Gran Apertura Editorial (7 cols)
           =================================================================== */}
        <div className="lg:col-span-7 flex flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs transition-all hover:shadow-md">
          <Link
            href={`/noticia/${principal.slug}`}
            className="group relative flex flex-col h-full"
          >
            {/* Contenedor de Imagen de Alto Impacto */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-2 sm:aspect-[16/9]">
              {principal.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  referrerPolicy="no-referrer"
                  src={principal.image_url}
                  alt=""
                  loading="eager"
                  fetchPriority="high"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              ) : (
                <PortadaGenerica
                  categoria={principal.category}
                  className="h-full w-full"
                  grosor={3}
                />
              )}

              {/* Badges superiores flotantes */}
              <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                <span className="badge-pill bg-accent text-accent-fg font-sans font-bold shadow-xs">
                  Apertura
                </span>
                <span className="badge-pill bg-surface/90 text-fg backdrop-blur-md border border-border-subtle shadow-xs">
                  {categoryName(principal.category)}
                </span>
              </div>

              {/* Chip de fuentes verificadas */}
              {extraSourcesCount > 0 && (
                <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1 text-[0.7rem] font-semibold text-white backdrop-blur-md border border-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {extraSourcesCount + 1} fuentes contrastadas
                </div>
              )}
            </div>

            {/* Contenido textual */}
            <div className="flex flex-1 flex-col justify-between p-5 sm:p-7">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-[2.25rem] font-black leading-[1.05] tracking-tight text-fg group-hover:text-accent transition-colors">
                  {principal.title}
                </h1>

                {principal.dek && (
                  <p className="font-serif mt-3 text-base sm:text-lg text-fg-muted leading-relaxed line-clamp-2">
                    {principal.dek}
                  </p>
                )}
              </div>

              <div className="meta mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/60 pt-4 text-xs text-fg-faint">
                <time dateTime={isoDate(principal.published_at)}>
                  {formatDate(principal.published_at)}
                </time>
                <span>/</span>
                <span>{principal.reading_minutes} min de lectura</span>
                <span>/</span>
                <span className="font-medium text-fg-muted">{principal.source_name}</span>
                <span>/</span>
                <span>{formatViews(principal.views)}</span>
              </div>
            </div>
          </Link>

          {/* Selector de historias en portada (si hay más de una) */}
          {destacadas.length > 1 && (
            <div className="border-t border-line/60 bg-bg-soft/50 px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
              <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-fg-faint shrink-0">
                Otras historias clave:
              </span>
              <div className="flex items-center gap-1.5">
                {destacadas.map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveStoryIdx(i)}
                    className={`h-7 px-3 rounded-full text-xs font-semibold transition-all ${
                      i === activeStoryIdx
                        ? "bg-accent text-accent-fg shadow-xs"
                        : "bg-surface text-fg-muted hover:bg-surface-2 border border-border-subtle"
                    }`}
                  >
                    0{i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================
            COLUMNA LATERAL (Radar & Tendencias en Vivo): 5 cols
           =================================================================== */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
          {/* Cabecera interactiva con Tabs */}
          <div className="flex items-center justify-between border-b border-line bg-bg-soft/40 px-5 py-3">
            <div className="flex items-center gap-1 bg-surface-2/80 p-1 rounded-xl border border-border-subtle">
              <button
                type="button"
                onClick={() => setActiveTab("recientes")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  activeTab === "recientes"
                    ? "bg-surface text-fg shadow-xs"
                    : "text-fg-faint hover:text-fg"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                En directo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("masLeidas")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  activeTab === "masLeidas"
                    ? "bg-surface text-fg shadow-xs"
                    : "text-fg-faint hover:text-fg"
                }`}
              >
                🔥 Tendencias
              </button>
            </div>

            <span className="text-[0.6875rem] font-mono text-fg-faint">
              RADAR
            </span>
          </div>

          {/* Lista de noticias reactiva */}
          <div className="flex-1 divide-y divide-line/60 overflow-y-auto max-h-[35rem] scroll-sutil">
            {activeTab === "recientes"
              ? recientes.map((art) => (
                  <Link
                    key={art.id}
                    href={`/noticia/${art.slug}`}
                    className="group flex flex-col gap-1.5 p-4 transition-colors hover:bg-surface-2/70"
                  >
                    <div className="flex items-center justify-between gap-2 text-[0.7rem]">
                      <span className="font-semibold text-accent uppercase tracking-wider">
                        {categoryName(art.category)}
                      </span>
                      <span className="font-mono text-fg-faint font-medium">
                        {formatRelative(art.published_at)}
                      </span>
                    </div>

                    <h3 className="font-sans font-bold text-sm text-fg leading-snug group-hover:text-accent transition-colors line-clamp-2">
                      {art.title}
                    </h3>

                    <div className="flex items-center gap-2 text-[0.72rem] text-fg-faint">
                      <span>{art.source_name}</span>
                      <span>•</span>
                      <span>{art.reading_minutes} min</span>
                      {art.extra_sources?.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-500 font-medium">
                            +{art.extra_sources.length} fuentes
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                ))
              : masLeidas.map((art, idx) => (
                  <Link
                    key={art.id}
                    href={`/noticia/${art.slug}`}
                    className="group flex items-start gap-3.5 p-4 transition-colors hover:bg-surface-2/70"
                  >
                    <span
                      className={`font-display text-2xl font-black tabular-nums shrink-0 w-7 ${
                        idx === 0
                          ? "text-accent"
                          : "text-fg-faint/50 group-hover:text-fg"
                      }`}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-[0.7rem] mb-0.5">
                        <span className="font-semibold text-accent uppercase tracking-wider">
                          {categoryName(art.category)}
                        </span>
                        <span className="text-fg-faint">•</span>
                        <span className="text-fg-faint">{formatViews(art.views)}</span>
                      </div>
                      <h3 className="font-sans font-bold text-sm text-fg leading-snug group-hover:text-accent transition-colors line-clamp-2">
                        {art.title}
                      </h3>
                    </div>
                  </Link>
                ))}
          </div>

          {/* Pie del radar */}
          <div className="border-t border-line/60 bg-bg-soft/30 px-4 py-2.5 text-center text-[0.7rem] text-fg-faint">
            Actualización autónoma continua · Fuentes globales contrastadas
          </div>
        </div>
      </div>
    </section>
  );
}
