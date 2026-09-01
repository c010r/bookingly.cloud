"use client";

import { useEffect } from "react";

/**
 * Registra una visita cuando el articulo se ha pintado de verdad.
 * Se hace en el cliente para no contar precargas ni rastreadores.
 */
export default function ViewCounter({ slug }: { slug: string }) {
  useEffect(() => {
    const clave = `visto:${slug}`;
    try {
      // Una visita por pestana y articulo: recargar no infla el contador.
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento contamos igual; peor eso que no contar nada.
    }
    fetch(`/api/vistas/${encodeURIComponent(slug)}`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
