import Link from "next/link";
import { logoutAction } from "./actions";

const enlaces = [
  { href: "/admin", label: "Borradores" },
  { href: "/admin?estado=published", label: "Publicados" },
  { href: "/admin?estado=rejected", label: "Descartados" },
  { href: "/admin/fuentes", label: "Fuentes" },
  { href: "/", label: "Ver sitio" },
];

export default function AdminBar({ title }: { title: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
      <div>
        <h1 className="font-mono text-base font-semibold">{title}</h1>
        <nav className="mt-2 flex flex-wrap gap-4 text-sm">
          {enlaces.map((e) => (
            <Link
              key={e.label}
              href={e.href}
              className="text-fg-muted transition-colors hover:text-neon"
            >
              {e.label}
            </Link>
          ))}
        </nav>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:border-danger hover:text-danger"
        >
          Salir
        </button>
      </form>
    </div>
  );
}
