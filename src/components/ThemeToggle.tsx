"use client";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const forced = document.documentElement.getAttribute("data-theme");
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("tema", next);
    } catch {
      // Navegacion privada: el cambio vale solo para esta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar entre tema claro y oscuro"
      title="Cambiar tema"
      className="grid h-9 w-9 place-items-center border-2 border-fg bg-bg text-fg transition-colors hover:bg-accent hover:border-accent hover:text-accent-fg"
    >
      {/* Los dos iconos van en el DOM y el CSS elige: asi sale el correcto
          antes de que React hidrate, sin parpadeo ni desajuste. */}
      <svg className="icon-sun h-[17px] w-[17px]" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" />
      </svg>
      <svg className="icon-moon h-[17px] w-[17px]" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
      </svg>
    </button>
  );
}
