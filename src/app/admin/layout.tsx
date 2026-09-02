import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // El <main> del sitio ya no lleva contenedor propio: lo pone cada pagina.
  return <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>;
}
