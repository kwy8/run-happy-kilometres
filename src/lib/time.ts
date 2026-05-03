// Format decimal minutes -> "MM:SS"
export function formatMinSec(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || isNaN(totalMinutes)) return "—";
  const totalSeconds = Math.round(totalMinutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Format pace (decimal min/km) -> "MM:SS /km"
export function formatPace(minPerKm: number | null | undefined): string {
  if (minPerKm == null || !isFinite(minPerKm) || isNaN(minPerKm)) return "—";
  return `${formatMinSec(minPerKm)} /km`;
}

// Combine minutes + seconds inputs into decimal minutes (or null)
export function combineMinSec(minStr: string, secStr: string): number | null {
  const m = minStr ? parseInt(minStr, 10) : 0;
  const s = secStr ? parseInt(secStr, 10) : 0;
  if ((!minStr && !secStr) || (m === 0 && s === 0)) return null;
  if (isNaN(m) || isNaN(s)) return NaN;
  return m + s / 60;
}

// Split decimal minutes into { min, sec } strings for editing
export function splitMinSec(totalMinutes: number | null | undefined): { min: string; sec: string } {
  if (totalMinutes == null || isNaN(totalMinutes)) return { min: "", sec: "" };
  const totalSeconds = Math.round(totalMinutes * 60);
  return {
    min: String(Math.floor(totalSeconds / 60)),
    sec: String(totalSeconds % 60),
  };
}
