import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Archivo, Newsreader } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import ThemeToggle from "@/components/ThemeToggle";
import LastUpdate from "@/components/LastUpdate";
import { env } from "@/lib/env";
import "./globals.css";

/**
 * Dos familias y ninguna mas. Archivo es una grotesca de asta ancha que
 * aguanta el peso 900 a tamano de cartel; Newsreader es una serif de prensa
 * para el cuerpo del texto y las entradillas.
 */
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--fuente-titular",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--fuente-texto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${env.siteName} — Noticias de tecnologia`,
    template: `%s · ${env.siteName}`,
  },
  description: env.siteDescription,
  openGraph: { type: "website", siteName: env.siteName, locale: "es_ES" },
  alternates: { types: { "application/rss+xml": `${env.siteUrl}/feed.xml` } },
};

/** Aplica el tema guardado antes del primer pintado, para que no parpadee. */
const NO_FLASH = `
try {
  var t = localStorage.getItem('tema');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Las variables de next/font van en <html>, no en <body>: --font-sans se
       declara en :root y ahi tiene que poder resolver --fuente-titular. Si se
       quedan en el body, el var() es invalido y toda la pagina cae a la
       tipografia del sistema sin avisar. */
    <html
      lang="es"
      className={`${archivo.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="min-h-screen">
        {/* Cabecera: filete grueso abajo, como la mancheta de un semanario. */}
        <header className="sticky top-0 z-40 border-b-2 border-fg bg-bg">
          <div className="contenedor flex h-16 items-center justify-between gap-4">
            <Link
              href="/"
              className="flex items-baseline gap-2"
              aria-label={`${env.siteName}, portada`}
            >
              <span className="font-display text-[1.6rem] leading-none font-black tracking-[-0.055em]">
                c<span className="text-accent">010</span>r
              </span>
              <span className="etiqueta text-fg-faint">News</span>
            </Link>

            <nav className="flex items-center gap-5">
              <Link
                href="/"
                className="etiqueta text-fg-muted transition-colors hover:text-accent"
              >
                Portada
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <Suspense fallback={null}>
          <SiteNav />
        </Suspense>

        <main>{children}</main>

        <footer className="mt-24 border-t-2 border-fg bg-bg">
          <div className="contenedor flex flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-display text-[2.6rem] leading-[0.85] font-black tracking-[-0.055em]">
                c<span className="text-accent">010</span>r
                <span className="text-fg-faint">News</span>
              </p>
              <p className="entradilla mt-3 max-w-sm text-[0.9rem] text-fg-muted">
                {env.siteDescription}
              </p>
            </div>

            <div className="meta flex flex-col gap-2 text-fg-faint sm:items-end">
              <Suspense fallback={null}>
                <LastUpdate />
              </Suspense>
              <span>
                © {new Date().getFullYear()} {env.siteName}
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
