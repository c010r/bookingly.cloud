"use client";

import { useEffect, useState } from "react";

export default function ReadingActionBar({
  slug,
  title,
  readingMinutes,
}: {
  slug: string;
  title: string;
  readingMinutes: number;
}) {
  const [visible, setVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [minutosRestantes, setMinutosRestantes] = useState(readingMinutes);

  useEffect(() => {
    function onScroll() {
      const scrollY = window.scrollY;
      const scrollTotal = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(scrollY > 280);

      if (scrollTotal > 0) {
        const pct = scrollY / scrollTotal;
        const rest = Math.max(1, Math.ceil(readingMinutes * (1 - pct)));
        setMinutosRestantes(rest);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [readingMinutes]);

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback
    }
  }

  function irAFuentes() {
    const el = document.getElementById("fuentes");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Controles de lectura rápidos"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className="flex items-center gap-3 rounded-full border border-border-subtle bg-surface/90 px-4 py-2 shadow-xl backdrop-blur-md text-xs text-fg font-sans">
        {/* Minutos restantes */}
        <span className="flex items-center gap-1.5 font-medium text-fg-muted font-mono border-r border-line pr-3">
          <svg className="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {minutosRestantes} min rest.
        </span>

        {/* Botón Copiar enlace */}
        <button
          type="button"
          onClick={copiarEnlace}
          aria-label="Copiar enlace de la noticia"
          className="flex items-center gap-1.5 font-semibold text-fg-muted hover:text-accent transition-colors cursor-pointer"
        >
          {copiado ? (
            <>
              <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-emerald-500">¡Copiado!</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5 text-fg-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copiar</span>
            </>
          )}
        </button>

        {/* Separador */}
        <span className="h-3 w-px bg-line" />

        {/* Saltar a fuentes */}
        <button
          type="button"
          onClick={irAFuentes}
          className="flex items-center gap-1 font-semibold text-fg-muted hover:text-accent transition-colors cursor-pointer"
        >
          <span>Fuentes</span>
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
