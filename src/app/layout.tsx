import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import SiteNav from "@/components/SiteNav";
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
  alternates: {
    types: { "application/rss+xml": `${env.siteUrl}/feed.xml` },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <div className="wrap inner">
            <Link href="/" className="logo">
              c<span className="zeros">010</span>r<span className="news">News</span>
            </Link>
            <nav className="nav">
              <Link href="/">Portada</Link>
              <Link href="/temas">Temas</Link>
              <Link href="/feed.xml">RSS</Link>
              <Link href="/admin">Panel</Link>
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
              © {new Date().getFullYear()} {env.siteName}. Contenido reescrito con IA a partir
              de fuentes publicas, siempre enlazadas y atribuidas.
            </span>
            <span>
              <Link href="/feed.xml">RSS</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
