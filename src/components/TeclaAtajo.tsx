"use client";

import { useEffect, useState } from "react";

/**
 * La tecla del atajo de busqueda, con el nombre que le da el teclado de quien
 * mira. En macOS es la de comando; en Windows y Linux, Control. El manejador
 * de CommandMenu ya acepta las dos, pero el cartel solo enseñaba la de Apple.
 *
 * Arranca en Ctrl a proposito: es lo que pinta el servidor, que no sabe desde
 * donde se le pide la pagina, y asi el primer render del cliente coincide y no
 * hay aviso de hidratacion. Si resulta ser un Mac, se corrige al montar.
 */
export default function TeclaAtajo({ className = "" }: { className?: string }) {
  const [mac, setMac] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setMac(/Mac|iPhone|iPad|iPod/.test(ua));
  }, []);

  return (
    <kbd className={className}>{mac ? "⌘K" : "Ctrl K"}</kbd>
  );
}
