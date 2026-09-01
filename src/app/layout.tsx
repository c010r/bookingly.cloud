import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import SiteNav from "@/components/SiteNav";
import ThemeToggle from "@/components/ThemeToggle";
import { env } from "@/lib/env";
import "./globals.css";

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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="techno-grid techno-glow min-h-screen">
        <div className="relative z-10">
          <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl backdrop-saturate-150">
            <div className="mx-auto flex h-[66px] max-w-6xl items-center justify-between gap-5 px-5">
              <Link
                href="/"
                className="glitch font-mono text-xl font-bold tracking-tight"
                aria-label={`${env.siteName}, portada`}
              >
                c<span className="text-neon">010</span>r
                <span className="ml-0.5 font-medium text-fg-faint">News</span>
              </Link>

              <nav className="flex items-center gap-5">
                <Link
                  href="/"
                  className="text-sm text-fg-muted transition-colors hover:text-fg"
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

          <main className="mx-auto max-w-6xl px-5">{children}</main>

          <footer className="mt-20 border-t border-line bg-bg-soft py-9">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 font-mono text-xs text-fg-faint">
              <span>
                © {new Date().getFullYear()} {env.siteName}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon" />
                actualizado cada 30 min
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
