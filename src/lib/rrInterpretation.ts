import { formatRR, RR_SCALE } from "./score";

export interface RrContext {
  /** Same-route prior RRs from this user (raw performance_score values, newest first). */
  routeHistory?: number[];
  /** Optional surface_type from the route. */
  surface?: "road" | "trail" | "mixed" | "track" | "gravel" | null;
  /** Optional technicality 1..5. */
  technicality?: number | null;
  /** Optional change in RPE vs previous run on this route. Negative = easier today. */
  rpeDelta?: number | null;
}

export function interpretRR(score: number | null | undefined, ctx: RrContext = {}): string | null {
  if (score == null || !isFinite(score)) return null;

  const lines: string[] = [];
  const history = (ctx.routeHistory || []).filter((n) => isFinite(n));
  if (history.length > 0) {
    const avg = history.reduce((s, n) => s + n, 0) / history.length;
    const deltaDisplay = (score - avg) * RR_SCALE;
    if (deltaDisplay >= 0.5) {
      lines.push(`Strong run for this route (+${deltaDisplay.toFixed(1)} vs your avg)`);
    } else if (deltaDisplay <= -0.5) {
      lines.push(`Off-pace today — recovery run? (${deltaDisplay.toFixed(1)} vs your avg)`);
    } else {
      lines.push(`On par with your usual on this route`);
    }
    if (ctx.rpeDelta != null && ctx.rpeDelta < 0 && deltaDisplay > 0) {
      lines.push("Improved RR at lower effort");
    }
  }

  if ((ctx.surface === "trail" || ctx.surface === "mixed") && (ctx.technicality ?? 0) >= 3) {
    lines.push("Technical-trail adjustment applied");
  }

  return lines.length ? lines.join(" · ") : null;
}

export function rrChipLine(score: number | null | undefined): string {
  return `RR ${formatRR(score)}`;
}
