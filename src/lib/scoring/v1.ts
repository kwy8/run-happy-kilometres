import type { ScoreInput } from "./types";

/**
 * v1: Score = (D / T) * (1 + alpha * (E_gain / D))
 * Mirrors the SQL trigger `recompute_event_result`.
 */
export function scoreV1(input: ScoreInput): number | null {
  const { distance_m, duration_s, elevation_gain_m, alpha } = input;
  if (!distance_m || !duration_s || distance_m <= 0 || duration_s <= 0) return null;
  if (alpha == null) return null;
  const grade = (elevation_gain_m ?? 0) / distance_m;
  return (distance_m / duration_s) * (1 + alpha * grade);
}
