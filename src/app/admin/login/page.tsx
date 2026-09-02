"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);

  return (
    <form
      action={formAction}
      className="mx-auto mt-[14vh] max-w-sm border border-line bg-surface p-8"
    >
      {/* Sin el prompt de terminal del diseno anterior: la mancheta del sitio
          ya no habla ese idioma. */}
      <h2 className="mb-6 border-b-2 border-fg pb-3 text-xl font-extrabold tracking-tight">
        Acceso a la redaccion
      </h2>

      {error && (
        <p className="mb-4 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <label
        htmlFor="password"
        className="etiqueta mb-1.5 block text-fg-faint"
      >
        Contrasena
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoFocus
        required
        className="mb-5 w-full border border-line bg-bg px-3 py-2.5 outline-none focus:border-accent"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full border border-accent bg-accent py-2.5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending ? "Comprobando..." : "Entrar"}
      </button>
    </form>
  );
}
