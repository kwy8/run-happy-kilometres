## Add to Calendar (.ics export) for events

Let any user who has joined an event download an `.ics` file to import into Apple Calendar, Google Calendar, Outlook, etc.

### Scope
- New button on the Event Details page, visible only when the user has joined the event (next to "Leave Event" / "Submit Manual Result").
- Label: "Add to Calendar" with a calendar icon.
- Clicking it generates and downloads `<event-title>.ics` client-side — no backend needed.

### .ics contents
- `SUMMARY`: event title
- `DTSTART` / `DTEND`: from `event_date` + `meetup_time` (default 1-hour duration if no end time). If `meetup_time` is null, emit an all-day event.
- `LOCATION`: event `location` (Meet-up Point)
- `DESCRIPTION`: route name + link back to the event details page
- `UID`: `${event.id}@happykilometres`
- `DTSTAMP`: now (UTC)
- Standard `VCALENDAR` / `VEVENT` wrapper with `PRODID:-//Happy Kilometres//EN`

### Implementation
- New helper `src/lib/ics.ts` with `buildEventIcs(event)` returning a string, and `downloadIcs(filename, content)` that creates a Blob and triggers download.
- Wire button in `src/pages/EventDetails.tsx` inside the `hasJoined` branch.

### Notes
- No new dependencies — hand-rolled .ics (small, well-defined format).
- No DB changes, no edge function.
- Times treated as local (floating time) since `meetup_time` has no timezone, which matches user intuition ("9:00 AM local").
