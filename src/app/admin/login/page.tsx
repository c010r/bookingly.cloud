"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);

  return (
    <form
      action={formAction}
      className="mx-auto mt-[14vh] max-w-sm rounded-xl border border-line bg-surface p-8"
    >
      <h2 className="mb-5 font-mono text-lg font-semibold">
        <span className="text-neon">$</span> acceso a la redaccion
      </h2>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <label
        htmlFor="password"
        className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-fg-faint"
      >
        Contrasena
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoFocus
        required
        className="mb-5 w-full rounded-lg border border-line bg-bg px-3 py-2.5 outline-none focus:border-neon"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-neon bg-neon py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending ? "Comprobando..." : "Entrar"}
      </button>
    </form>
  );
}
