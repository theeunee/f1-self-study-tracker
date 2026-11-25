# Slice 7 · Extras

Goal history with export and the colour board shipped with Goals (slice 1); see `../slice-1-goals/`. This slice adds calendar sync.

| Shot | State |
|---|---|
| `01-calendar-events-dotted.jpg` | Calendar events dotted on Race week with + / × (local sample calendar) |
| `02-event-added-as-lap.jpg` | After + on "Team sync": a grey lap with no goal, logged with Undo |

## How it works
- **`supabase/functions/calendar`** (Edge Function) is the only place that stores or fetches iCal links. The browser can't read `ics_url`: column grants are in the migration. Actions: `add` (checks that the link returns a calendar first), `remove`, and `events` (fetches and parses each source for a date range in your time zone).
- **`supabase/functions/_shared/ics.ts`**: a small iCalendar reader with no dependencies. It handles UTC, TZID and all-day times, DURATION, RRULE (daily, weekly with BYDAY, monthly, yearly; INTERVAL, COUNT, UNTIL), EXDATE, RECURRENCE-ID overrides and cancelled events. It has 5 unit tests (`npm test`). All-day events are left off the hour grids.
- The app refreshes events on load, when calendars change, and every 15 minutes. Events show dotted on Home (HOURS and LIST) and Race week.
- **+** adds an event as a lap with **no goal**; give it one later. **×** dismisses it. Both are logged and can be undone today.

## What each control does
- **Account menu → CALENDARS**: lists your calendars (× removes one). With Supabase: pick GOOGLE / APPLE / OTHER, give an optional name, paste the private iCal link, then **ADD CALENDAR**. In local mode it explains the server is needed, and **ADD A SAMPLE CALENDAR** shows four example events each week so the feature can be tried.

## Not tested
- The Edge Function itself. There's no Supabase project here, so it hasn't been deployed or called. Only the parser is tested.
