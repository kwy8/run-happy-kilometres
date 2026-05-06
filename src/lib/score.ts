// Run Rating (RR) — user-facing name for performance_score.
// performance_score is roughly meters/second adjusted for elevation via alpha.
// Multiply by a friendly scale so values read like "8.5" instead of "0.0024".
export const RR_SCALE = 60;

export function formatRR(score: number | null | undefined): string {
  if (score == null || !isFinite(score)) return "—";
  return (score * RR_SCALE).toFixed(1);
}

export const RR_LABEL = "Run Rating";
export const RR_ABBR = "RR";
export const RR_TOOLTIP =
  "Run Rating (RR) blends pace with elevation, using each route's calibrated alpha. Higher is better.";
