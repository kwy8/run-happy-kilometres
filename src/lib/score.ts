// Run Rating (RR) — user-facing name for performance_score.
// performance_score is roughly meters/second adjusted for elevation via alpha.
export const RR_SCALE = 1;

export function formatRR(score: number | null | undefined): string {
  if (score == null || !isFinite(score)) return "—";
  return (score * RR_SCALE).toFixed(3);
}

export const RR_LABEL = "Run Rating";
export const RR_ABBR = "RR";
export const RR_TOOLTIP =
  "Run Rating (RR) blends pace with elevation, using each route's calibrated alpha. Higher is better.";
