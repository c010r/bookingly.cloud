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
  openGraph: {
    type: "website",
    siteName: env.siteName,
    locale: "es_ES",
  },
  // El feed sigue publicado y es detectable por lectores y agregadores,
  // aunque ya no haya un boton visible que apunte a el.
  alternates: {
    types: { "application/rss+xml": `${env.siteUrl}/feed.xml` },
  },
};

/**
 * Aplica el tema guardado antes del primer pintado. Si esperaramos a React,
 * el lector veria un fogonazo del tema equivocado en cada carga.
 */
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
      <body>
        <header className="site-header">
          <div className="wrap inner">
            <Link href="/" className="logo">
              c<span className="zeros">010</span>r<span className="news">News</span>
            </Link>
            <nav className="nav">
              <Link href="/">Portada</Link>
              <Link href="/temas">Temas</Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <Suspense fallback={null}>
          <SiteNav />
        </Suspense>

        <main className="wrap">{children}</main>

        <footer className="site-footer">
          <div className="wrap inner">
            <span>
              © {new Date().getFullYear()} {env.siteName}
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
