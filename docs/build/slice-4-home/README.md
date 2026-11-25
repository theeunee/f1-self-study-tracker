# Slice 4 · Home

Screenshots were taken at 1440×900 with the sample race on Tue 24 Nov at about 21:10.

| Shot | State |
|---|---|
| `01-home-hours.jpg` | HOURS view: done laps in black with ON PLAN, the paused lap as the timer row with AUTO-END, the now line |
| `02-home-list-paused.jpg` | LIST view: the active (paused) lap expanded with AUTO-END / RESUME / MOVE TO LATER and its recorded times |
| `03-onboard-running.jpg` | ONBOARD while a lap runs: countdown, progress track, AUTO-END, PAUSE, up next, a radio line |
| `04-race-plan.jpg` | RACE PLAN: focus, planned hours by day stacked by goal, targets, subgoal focus, notes from the last debrief |
| `05-move-to-later.jpg` | MOVE TO LATER |
| `06-after-move.jpg` | After moving: the lap stays struck through as MOVED, the day pill turns ON PLAN, Tuesday gets the ✓ |

## What each control does

**Header**
- **ONBOARD**: full-screen black view of the active lap. Esc or EXIT ONBOARD closes it.

**Banner**
- **Date**: today.
- **Countdown**: hover for EDIT. It counts to the Mechanics session by default, or to a custom D-day you add. It's shared with Race week; the session countdown can't be removed.
- **RACE N · X OF Y LAPS DONE**: race progress.
- **RACE PLAN**: opens the brief from the last session (read-only).

**Calendar**
- Scrolls endlessly with no visible scrollbar. The month title follows the scroll.
- The current race is a continuous band. Marks: ● time recorded, ✓ all laps done, chequered square = Mechanics session.
- Click a day to show its laps on the right. **📅** comes back to today.

**Divider**: drag, or focus it and use ← / →, to resize the calendar against the laps.

**Laps panel**
- **Header**: the day total, e.g. `3 OF 3 DONE · 2h / 2h`. A pill shows ON PLAN (black), +X OVER (red) or −X UNDER (outlined) once the day is past, all done, or over.
- **LIST / HOURS**: switches the view.
- **HOURS**: hover a lap today for **LOG TIME** and **MOVE TO LATER**. Clicking a lap opens it in LIST. Dotted repeat or calendar copies have **+ ADD** and **×**.
- **LIST**: click a row to expand **START LAP / LOG TIME / MOVE TO LATER**, the description and the recorded times. Today's recorded times show **EDIT** on hover, which opens edit mode with REMOVE THIS TIME.
- **Active lap**: **AUTO-END** (on by default; stops the lap once its planned time is timed), **PAUSE / RESUME**, and **KEEP GOING** after an auto-end (turns auto-end off and carries on recording). The row fills red as time passes. Overtime shows `+MM:SS` without a penalty.

**Dialogs**
- **LOG TIME**: STARTED / FINISHED (today), MARK AS COMPLETE. Edit mode adds REMOVE THIS TIME. Logged, with Undo.
- **MOVE TO LATER**: a later day in this race (today shows as LATER TODAY) and a start time. The old lap stays as MOVED, and a copy with the time it had left goes to the new slot. A running timer stops and its time is kept. Logged, with Undo.

**ONBOARD**: AUTO-END, PAUSE / RESUME / KEEP GOING. With nothing running it shows the time with seconds; **START NEXT LAP** first shows the lap's goal, title, time and description with **START LAP / NOT YET**.

## Not in the designs (my call, easy to change)
- In HOURS view, clicking a lap opens it in LIST view, so START LAP and PAUSE are one click away. The designs only show hover buttons there.
