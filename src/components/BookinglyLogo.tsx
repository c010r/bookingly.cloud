import Image from "next/image";

interface BookinglyLogoProps {
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  badgeText?: string;
  variant?: "vector" | "image";
  className?: string;
}

export function BookinglyIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0`}
      aria-hidden="true"
    >
      <defs>
        {/* Gradientes de alta tecnología: cian eléctrico y acento bermellón */}
        <linearGradient id="tech-cyan" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00f2fe" />
          <stop offset="60%" stopColor="#00b4d8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        <linearGradient id="tech-accent" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff381e" />
          <stop offset="100%" stopColor="#ff6b4a" />
        </linearGradient>
      </defs>

      {/* Tallo principal tecnológico estilo microchip / bus de datos */}
      <path
        d="M8 6C8 4.89543 8.89543 4 10 4H15V36H10C8.89543 36 8 35.1046 8 34V6Z"
        fill="url(#tech-cyan)"
      />
      {/* Pistas internas de silicio */}
      <line x1="11.5" y1="9" x2="11.5" y2="15" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="11.5" y1="25" x2="11.5" y2="31" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.85" />

      {/* Impulsos horizontales de entrada de datos / feed RSS */}
      <line x1="2" y1="20" x2="15" y2="20" stroke="#00f2fe" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="4" y1="16" x2="11" y2="16" stroke="url(#tech-accent)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3" y1="24" x2="12" y2="24" stroke="#00f2fe" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.8" />

      {/* Lóbulo superior de la B con corte cibernético */}
      <path
        d="M15 4H24C27.866 4 31 7.13401 31 11C31 14.866 27.866 18 24 18H15V4Z"
        stroke="url(#tech-cyan)"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ondas de transmisión / radiodifusión de noticias tecnológicas en vivo */}
      <path
        d="M27 6C29.8 7.5 32 10 32.5 13"
        stroke="#00f2fe"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 3.8C35.8 6.2 38.5 9.8 39 14.5"
        stroke="#00f2fe"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />

      {/* Lóbulo inferior con geometría angulada y núcleo de acento */}
      <path
        d="M15 18H25.5C29.6421 18 33 21.3579 33 25.5C33 28.5 31.2 31.5 28 33L23.5 36H15V18Z"
        fill="url(#tech-cyan)"
        fillOpacity="0.16"
        stroke="url(#tech-cyan)"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Núcleo de datos en ángulo bermellón */}
      <polygon
        points="18.5,23 25.5,23 22,30 18.5,30"
        fill="url(#tech-accent)"
      />
    </svg>
  );
}

export default function BookinglyLogo({
  size = "md",
  showBadge = true,
  badgeText = "Tech News",
  variant = "vector",
  className = "",
}: BookinglyLogoProps) {
  const iconDimensions = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-9 h-9",
  }[size];

  const textStyles = {
    sm: "text-lg",
    md: "text-[1.65rem]",
    lg: "text-[2.2rem]",
  }[size];

  const badgeStyles = {
    sm: "px-1.5 py-0.2 text-[0.6rem]",
    md: "px-2 py-0.5 text-[0.6875rem]",
    lg: "px-2.5 py-0.5 text-xs",
  }[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {variant === "image" ? (
        <div className="relative overflow-hidden rounded-lg shadow-sm border border-cyan-500/20">
          <Image
            src="/bookingly-tech-logo.jpg"
            alt="Bookingly Tech News"
            width={size === "lg" ? 44 : size === "md" ? 34 : 24}
            height={size === "lg" ? 44 : size === "md" ? 34 : 24}
            className="object-cover rounded-lg"
          />
        </div>
      ) : (
        <div className="transition-transform duration-300 group-hover:scale-105">
          <BookinglyIcon className={iconDimensions} />
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <span
          className={`font-display font-black leading-none tracking-[-0.045em] text-fg ${textStyles}`}
        >
          Bookingly
        </span>

        {showBadge && (
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-accent/10 font-bold uppercase tracking-wider text-accent border border-accent/25 ${badgeStyles}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}
