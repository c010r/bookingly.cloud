"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryName } from "@/lib/categories";

type SearchItem = {
  id: number;
  title: string;
  slug: string;
  category: string;
  dek: string | null;
  reading_minutes: number;
  source_name: string;
  published_at: string;
};

export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Escuchar atajo Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Foco al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Búsqueda con debounce
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Teclado en resultados (flechas arriba/abajo y enter)
  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      const target = results[selectedIndex];
      setOpen(false);
      startTransition(() => {
        router.push(`/noticia/${target.slug}`);
      });
    }
  }

  return (
    <>
      {/* Botón disparador visible en la cabecera */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir buscador"
        className="flex items-center gap-2.5 rounded-full border border-line bg-surface-2/80 px-3.5 py-1.5 text-xs text-fg-muted transition-all hover:border-accent hover:bg-surface hover:text-fg hover:shadow-sm"
      >
        <svg
          className="h-3.5 w-3.5 text-fg-faint"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="hidden sm:inline">Buscar noticias...</span>
        <span className="sm:hidden">Buscar</span>
        <kbd className="hidden sm:inline rounded bg-bg px-1.5 py-0.5 font-mono text-[0.65rem] font-medium text-fg-faint border border-line">
          ⌘K
        </kbd>
      </button>

      {/* Modal Backdrop & Command Palette */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del buscador */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
              <svg
                className="h-5 w-5 text-accent shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar por titular, tecnología o temática..."
                className="w-full bg-transparent text-sm font-medium text-fg placeholder:text-fg-faint focus:outline-none"
              />
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded p-1 text-fg-faint hover:text-fg"
                >
                  ✕
                </button>
              ) : (
                <kbd className="rounded border border-line bg-bg-soft px-1.5 py-0.5 text-[0.65rem] font-mono text-fg-faint">
                  ESC
                </kbd>
              )}
            </div>

            {/* Resultados o sugerencias */}
            <div className="max-h-[60vh] overflow-y-auto p-2 scroll-sutil">
              {results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((art, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <Link
                        key={art.id}
                        href={`/noticia/${art.slug}`}
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex flex-col gap-1 rounded-xl p-3 text-left transition-colors ${
                          isSelected
                            ? "bg-accent/10 border-l-2 border-accent"
                            : "hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-[0.7rem] font-semibold text-fg-faint uppercase">
                          <span className="text-accent">{categoryName(art.category)}</span>
                          <span>•</span>
                          <span>{art.source_name}</span>
                          <span>•</span>
                          <span>{art.reading_minutes} min</span>
                        </div>
                        <h4 className="font-sans font-bold text-sm text-fg leading-snug">
                          {art.title}
                        </h4>
                        {art.dek && (
                          <p className="line-clamp-1 text-xs text-fg-muted font-serif">
                            {art.dek}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : query.trim().length >= 2 && !loading ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-fg">No se encontraron noticias</p>
                  <p className="mt-1 text-xs text-fg-muted">
                    Prueba con términos más generales como &ldquo;IA&rdquo;, &ldquo;Apple&rdquo;, &ldquo;Linux&rdquo;...
                  </p>
                </div>
              ) : (
                <div className="p-4 text-xs text-fg-faint">
                  <p className="font-semibold uppercase tracking-wider text-[0.65rem] text-fg-muted mb-2">
                    Navegación Rápida
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["ia", "software", "hardware", "ciberseguridad", "infraestructura"].map((cat) => (
                      <Link
                        key={cat}
                        href={`/categoria/${cat}`}
                        onClick={() => setOpen(false)}
                        className="rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 text-xs text-fg-muted hover:border-accent hover:text-accent transition-colors"
                      >
                        #{categoryName(cat)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pie de navegación rápida */}
            <div className="flex items-center justify-between border-t border-line bg-bg-soft/50 px-4 py-2 text-[0.7rem] text-fg-faint">
              <span>Navega con ↑ ↓ y presiona Enter</span>
              <span>c010r News Search Engine</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
