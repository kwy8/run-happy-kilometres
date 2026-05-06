export type ScoreInput = {
  distance_m: number;
  duration_s: number;
  elevation_gain_m: number;
  alpha: number;
  // Reserved for future versions:
  terrain_modifier?: number;
  weather_modifier?: number;
};

export const CURRENT_SCORING_VERSION = 1 as const;
export type ScoringFormulaVersion = 1; // bump union as new versions ship
