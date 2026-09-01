/** Clase CSS del indicador de calidad segun el corte de publicacion automatica. */
export function scoreClass(score: number): string {
  if (score >= 78) return "score-high";
  if (score >= 55) return "score-mid";
  return "score-low";
}
