"use client";

import { useFormStatus } from "react-dom";
import { ingestAction } from "./actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
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
