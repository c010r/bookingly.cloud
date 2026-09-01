/** Color del indicador de calidad. El corte de publicacion es configurable,
 *  asi que estos umbrales son solo orientativos para el ojo humano. */
export function scoreClass(score: number): string {
  if (score >= 78) return "border-neon/50 bg-neon/10 text-neon";
  if (score >= 55) return "border-amber-500/40 bg-amber-500/10 text-amber-500";
  return "border-danger/40 bg-danger/10 text-danger";
}

export function statusClass(status: string): string {
  if (status === "published") return "border-neon/50 bg-neon/10 text-neon";
  if (status === "draft") return "border-amber-500/40 bg-amber-500/10 text-amber-500";
  return "border-line bg-surface-2 text-fg-faint";
}
