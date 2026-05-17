// Minimal .ics generator for event calendar export.

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

// Floating local time: YYYYMMDDTHHMMSS (no Z) — calendar app uses viewer's local tz.
function formatLocal(date: string, time: string): string {
  const [hh, mm] = time.split(":");
  const d = date.replace(/-/g, "");
  return `${d}T${pad(parseInt(hh, 10))}${pad(parseInt(mm, 10))}00`;
}

function formatDateOnly(date: string): string {
  return date.replace(/-/g, "");
}

function formatUtcStamp(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function addOneHour(time: string): string {
  const [hh, mm] = time.split(":").map((x) => parseInt(x, 10));
  const next = (hh + 1) % 24;
  return `${pad(next)}:${pad(mm)}`;
}

export interface IcsEventInput {
  id: string;
  title: string;
  event_date: string; // YYYY-MM-DD
  meetup_time: string | null; // HH:MM[:SS]
  route?: string | null;
  location?: string | null;
  url?: string;
}

export function buildEventIcs(ev: IcsEventInput): string {
  const dtstamp = formatUtcStamp(new Date());
  const uid = `${ev.id}@happykilometres`;
  const descLines = [
    ev.route ? `Route: ${ev.route}` : null,
    ev.url ? `Details: ${ev.url}` : null,
  ].filter(Boolean) as string[];
  const description = escapeText(descLines.join("\n"));

  let dtStartLine: string;
  let dtEndLine: string;

  if (ev.meetup_time) {
    const timeHHMM = ev.meetup_time.slice(0, 5);
    dtStartLine = `DTSTART:${formatLocal(ev.event_date, timeHHMM)}`;
    dtEndLine = `DTEND:${formatLocal(ev.event_date, addOneHour(timeHHMM))}`;
  } else {
    // All-day event
    const d = formatDateOnly(ev.event_date);
    const next = new Date(ev.event_date + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    const nextStr =
      next.getUTCFullYear().toString() +
      pad(next.getUTCMonth() + 1) +
      pad(next.getUTCDate());
    dtStartLine = `DTSTART;VALUE=DATE:${d}`;
    dtEndLine = `DTEND;VALUE=DATE:${nextStr}`;
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Happy Kilometres//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapeText(ev.title)}`,
    ev.location ? `LOCATION:${escapeText(ev.location)}` : null,
    description ? `DESCRIPTION:${description}` : null,
    ev.url ? `URL:${ev.url}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  return lines.join("\r\n");
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
