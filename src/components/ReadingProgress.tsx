"use client";

import { useEffect, useState } from "react";

export default function ReadingProgress() {
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    function calcularProgreso() {
      const scrollTotal = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollTotal <= 0) {
        setProgreso(0);
        return;
      }
      const actual = window.scrollY;
      const pct = Math.min(100, Math.max(0, (actual / scrollTotal) * 100));
      setProgreso(pct);
    }

    window.addEventListener("scroll", calcularProgreso, { passive: true });
    calcularProgreso();

    return () => window.removeEventListener("scroll", calcularProgreso);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-accent transition-[width] duration-150 ease-out shadow-[0_0_8px_var(--glow-accent)]"
        style={{ width: `${progreso}%` }}
      />
    </div>
  );
}
