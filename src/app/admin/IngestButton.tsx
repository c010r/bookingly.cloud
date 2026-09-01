"use client";

import { useFormStatus } from "react-dom";
import { ingestAction } from "./actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-neon bg-neon px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
    >
      {pending ? "Buscando y reescribiendo..." : "Ingerir noticias"}
    </button>
  );
}

export default function IngestButton() {
  return (
    <form action={ingestAction}>
      <Button />
    </form>
  );
}
