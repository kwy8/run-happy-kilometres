import { scoreV1 } from "./v1";
import { CURRENT_SCORING_VERSION, type ScoreInput, type ScoringFormulaVersion } from "./types";

export { CURRENT_SCORING_VERSION };
export type { ScoreInput, ScoringFormulaVersion };

export function score(input: ScoreInput, version: ScoringFormulaVersion = CURRENT_SCORING_VERSION): number | null {
  switch (version) {
    case 1:
      return scoreV1(input);
    default:
      throw new Error(`Unknown scoring formula version: ${version}`);
  }
}
