"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="login-box">
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Acceso a la redaccion</h2>
      {error && <div className="notice error">{error}</div>}
      <div className="field">
        <label htmlFor="password">Contrasena</label>
        <input id="password" name="password" type="password" autoFocus required />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Comprobando..." : "Entrar"}
      </button>
    </form>
  );
}
