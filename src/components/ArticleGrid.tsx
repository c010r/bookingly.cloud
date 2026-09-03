"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Article } from "@/lib/repo";
import ArticleCard from "./ArticleCard";
import { categoryName } from "@/lib/categories";
import { formatDate, formatViews } from "@/lib/format";

export default function ArticleGrid({
  articulos,
  amplias = 2,
  permitirCambioVista = true,
}: {
  articulos: Article[];
  amplias?: number;
  permitirCambioVista?: boolean;
}) {
  const [vista, setVista] = useState<"revista" | "stream">("revista");

  useEffect(() => {
    try {
      const guardada = localStorage.getItem("c010r-view-mode");
      if (guardada === "revista" || guardada === "stream") {
        setVista(guardada);
      }
    } catch {
      // Ignorar errores de localStorage en navegación privada
    }
  }, []);

  function cambiarVista(nueva: "revista" | "stream") {
    setVista(nueva);
    try {
      localStorage.setItem("c010r-view-mode", nueva);
    } catch {
      // Navegación privada
    }
  }

  if (!articulos || articulos.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Selector de densidad de visualización */}
      {permitirCambioVista && articulos.length > 3 && (
        <div className="flex items-center justify-end">
          <div className="inline-flex items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 shadow-xs">
            <button
              type="button"
              onClick={() => cambiarVista("revista")}
              aria-label="Vista de revista con imágenes"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                vista === "revista"
                  ? "bg-accent text-accent-fg shadow-xs"
                  : "text-fg-faint hover:text-fg"
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              <span>Revista</span>
            </button>

            <button
              type="button"
              onClick={() => cambiarVista("stream")}
              aria-label="Vista compacta de stream / terminal"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                vista === "stream"
                  ? "bg-accent text-accent-fg shadow-xs"
                  : "text-fg-faint hover:text-fg"
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" x2="21" y1="6" y2="6" strokeLinecap="round" />
                <line x1="3" x2="21" y1="12" y2="12" strokeLinecap="round" />
                <line x1="3" x2="21" y1="18" y2="18" strokeLinecap="round" />
              </svg>
              <span>Stream</span>
            </button>
          </div>
        </div>
      )}

      {/* Vista Revista (Grid con Bento y Cards) */}
      {vista === "revista" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6">
          {articulos.map((a, i) => (
            <div
              key={a.id}
              className={i < amplias ? "lg:col-span-3" : "lg:col-span-2"}
            >
              <ArticleCard
                article={a}
                index={i}
                variante={i < amplias ? "amplia" : "estandar"}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Vista Stream (Modo compacto tipo terminal de noticias tech) */
        <div className="divide-y divide-border-subtle rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
          {articulos.map((a) => (
            <Link
              key={a.id}
              href={`/noticia/${a.slug}`}
              className="group flex flex-col gap-2 p-4 transition-colors hover:bg-surface-2/60 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div className="flex flex-1 items-start gap-3 min-w-0">
                <span className="badge-pill shrink-0 mt-0.5 bg-surface-2 text-accent border border-border-subtle">
                  {categoryName(a.category)}
                </span>
                <div className="min-w-0">
                  <h4 className="font-sans font-bold text-sm text-fg group-hover:text-accent transition-colors truncate">
                    {a.title}
                  </h4>
                  {a.dek && (
                    <p className="font-serif text-xs text-fg-muted line-clamp-1 mt-0.5">
                      {a.dek}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 text-xs text-fg-faint font-mono">
                <span>{a.source_name}</span>
                <span>•</span>
                <span>{a.reading_minutes}m</span>
                <span>•</span>
                <span>{formatViews(a.views)}</span>
                <span className="hidden md:inline">•</span>
                <span className="hidden md:inline">{formatDate(a.published_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
