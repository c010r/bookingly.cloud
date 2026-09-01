import Link from "next/link";
import { logoutAction } from "./actions";

export default function AdminBar({ title }: { title: string }) {
  return (
    <div className="admin-bar">
      <div>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        <nav style={{ marginTop: 8 }}>
          <Link href="/admin">Borradores</Link>
          <Link href="/admin?estado=published">Publicados</Link>
          <Link href="/admin?estado=rejected">Descartados</Link>
          <Link href="/admin/fuentes">Fuentes</Link>
          <Link href="/">Ver sitio</Link>
        </nav>
      </div>
      <form action={logoutAction}>
        <button className="btn" type="submit">
          Salir
        </button>
      </form>
    </div>
  );
}
