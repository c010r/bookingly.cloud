import type { CategorySlug } from "@/lib/categories";

/**
 * Portada generica para las notas que llegan sin imagen (unas 30 de 482).
 *
 * Es un SVG dibujado en el codigo, no un fichero: no pesa, escala a cualquier
 * tamano y se adapta solo al tema. Hay una variante por seccion (motivo
 * geometrico + tono propios) para que treinta notas no compartan la misma
 * estampa y para que de un vistazo se distinga si la pieza es de IA, de
 * hardware o de apps.
 *
 * Es decorativa: va con aria-hidden y sin texto. El titular y el antetitulo
 * que hay justo debajo ya dicen de que va la nota.
 *
 * El tono base y el del trazo se derivan en CSS mezclando el color de la
 * seccion con --bg y --fg (ver .portada-generica en globals.css), asi que una
 * sola definicion sirve para claro y para oscuro.
 */

/** Trama diagonal de fondo: marca la pieza como ilustracion, no como foto. */
// El rango va de sobra por los dos lados para que ninguna esquina se quede
// sin trama al recortar el SVG en proporciones distintas.
const TRAMA = Array.from({ length: 30 }, (_, i) => -264 + i * 24);

/**
 * Un motivo por seccion, dibujado dentro de la zona segura (x 90-230,
 * y 30-170) para que el recorte no se coma nada en ninguna proporcion.
 */
const MOTIVOS: Record<CategorySlug, React.ReactNode> = {
  // Red neuronal: nodos enlazados.
  ia: (
    <>
      <path d="M112 62 L160 100 L112 138 M160 100 L208 62 M160 100 L208 138 M112 62 L208 62 M112 138 L208 138" />
      <circle cx="112" cy="62" r="9" />
      <circle cx="112" cy="138" r="9" />
      <circle cx="160" cy="100" r="12" />
      <circle cx="208" cy="62" r="9" />
      <circle cx="208" cy="138" r="9" />
    </>
  ),
  // Ventanas apiladas y un cursor de bloque.
  software: (
    <>
      <rect x="100" y="46" width="104" height="76" />
      <rect x="120" y="66" width="104" height="76" />
      <path d="M120 88 H224" />
      <path d="M136 112 h20 M166 112 h34" />
    </>
  ),
  // Bastidor de servidores apilados.
  infraestructura: (
    <>
      <rect x="106" y="44" width="108" height="32" />
      <rect x="106" y="86" width="108" height="32" />
      <rect x="106" y="128" width="108" height="32" />
      <path d="M122 60 h10 M122 102 h10 M122 144 h10" />
      <circle cx="196" cy="60" r="4" />
      <circle cx="196" cy="102" r="4" />
      <circle cx="196" cy="144" r="4" />
    </>
  ),
  // Chip con sus patillas.
  hardware: (
    <>
      <rect x="118" y="58" width="84" height="84" />
      <rect x="142" y="82" width="36" height="36" />
      <path d="M136 58 V38 M160 58 V38 M184 58 V38 M136 142 V162 M160 142 V162 M184 142 V162 M118 76 H98 M118 100 H98 M118 124 H98 M202 76 H222 M202 100 H222 M202 124 H222" />
    </>
  ),
  // Escudo.
  ciberseguridad: (
    <>
      <path d="M160 36 L212 56 V104 c0 30 -24 50 -52 60 c-28 -10 -52 -30 -52 -60 V56 Z" />
      <path d="M160 62 v52" />
      <circle cx="160" cy="130" r="7" />
    </>
  ),
  // Globo con meridianos.
  internet: (
    <>
      <circle cx="160" cy="100" r="58" />
      <ellipse cx="160" cy="100" rx="24" ry="58" />
      <path d="M102 100 H218 M112 70 H208 M112 130 H208" />
    </>
  ),
  // Barras y curva ascendente.
  negocios: (
    <>
      <path d="M104 156 H216" />
      <rect x="110" y="112" width="22" height="44" />
      <rect x="146" y="88" width="22" height="68" />
      <rect x="182" y="58" width="22" height="98" />
      <path d="M104 92 L140 66 L172 78 L214 40" />
      <path d="M196 40 h18 v18" />
    </>
  ),
};

export default function PortadaGenerica({
  categoria,
  className = "",
  grosor = 2,
}: {
  categoria: string;
  /** Debe fijar la misma caja que ocuparia la foto, para que la rejilla no baile. */
  className?: string;
  /** Grosor del trazo en pixeles de pantalla; no escala con el SVG. */
  grosor?: number;
}) {
  const motivo = MOTIVOS[categoria as CategorySlug] ?? MOTIVOS.software;

  return (
    <div
      className={`portada-generica ${className}`}
      data-seccion={categoria}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 320 200"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
        role="presentation"
        className="h-full w-full"
      >
        {/* Ojo: el color NO puede ir en atributos (fill="var(...)"), porque
            var() no se admite en atributos de presentacion de SVG y el
            navegador descarta el valor. Va todo por CSS en globals.css. */}
        <rect className="pg-fondo" width="320" height="200" />

        <g className="pg-trama">
          {TRAMA.map((x) => (
            <line key={x} x1={x} y1="220" x2={x + 220} y2="-20" />
          ))}
        </g>

        <g className="pg-motivo" style={{ strokeWidth: grosor }}>
          {motivo}
        </g>
      </svg>
    </div>
  );
}
