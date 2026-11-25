# Slices 2–3 · Race week (Driver mode and Mechanics mode)

Screenshots were taken at 1440×900 with the sample race (Race 04, Sun 22 – Sat 28 Nov) on Tue 24 Nov at about 21:05. Shots 08–10 are from the Mechanics session; their full flow is covered in slice 6.

| Shot | State |
|---|---|
| `01-driver.jpg` | Driver mode: the hour grid, the goals panel, a record checkbox on untimed past laps, the session block on Saturday |
| `02-record-by-hand.jpg` | Ticking an untimed past lap opens "Record by hand" |
| `03-mechanics-mode.jpg` | Mechanics mode: past hours hatched, planned hours at 50% behind each goal bar, START MECHANICS SESSION |
| `04-new-lap.jpg` | NEW LAP from clicking an empty slot (prefilled with the day and time) |
| `05-save-prompt.jpg` | Leaving with unsaved changes: SAVE / DISCARD / KEEP EDITING, listing net changes |
| `06-move-session.jpg` | Dragging the session block earlier asks first |
| `07-scroll-days-folded.jpg` | SCROLL DAYS with the goals panel folded into pies |
| `08-session-carry-drop.jpg` | Session: Race week opens on the unfinished laps |
| `09-session-plan-repeats.jpg` | Session: planning the next race, with a repeating lap dotted on every day |
| `10-session-new-lap-repeat.jpg` | Session: NEW LAP with REPEAT |

## What each control does

**Header and page bar**
- **DRIVER MODE ⇄ / MECHANICS MODE ⇄** (header): toggles mid-race Mechanics mode. If you have unsaved changes, it asks SAVE / DISCARD / KEEP EDITING. It's hidden during the session.
- **Countdown** (Driver): the same D-day as Home. Hover it for **EDIT** to pick the session or a custom date, add one, or remove one. The session countdown can't be removed.
- **THIS RACE / SCROLL DAYS** (Driver): one race week, or endless sideways scrolling across races.
- **SAVE** (Mechanics mode): writes the draft. The log gets one entry per lap with its net change. The label beside it shows `N UNSAVED CHANGES` or `ALL SAVED`.
- **+ NEW LAP** (Mechanics mode and session): opens the form with the day set to NOT YET (Laps to place).
- **UNFINISHED LAPS · N LEFT** and **EDIT GOALS** (session): reopen carry/drop, or go to Goals.

**Grid**
- **Block**: click to show its details in the side panel. The start time sits faded in the corner. A block sits where the lap actually happened.
- **Checkbox on a block** (Driver): a past lap that was never timed. It opens Record by hand; saving records the time and marks the lap done.
- **Drag a block** (Mechanics mode or session, laps with no recorded time only): moves it to another day or time, snapped to 15 minutes. Drag the top or bottom edge to change its length.
- **Click or drag down on an empty slot** (Mechanics mode or session): opens NEW LAP with that time. Hours already gone can't be used.
- **Session block**: drag it earlier (Mechanics mode). It asks first, says how many laps would become unfinished, and logs the move; Undo works today.
- **Dotted copies**: **+** keeps that day's copy of a repeating lap, **×** skips it. Both are logged.
- **📅**: jumps back to today.

**Side panel**
- **Goal dot**: recolours the goal. **«** folds the panel into pies.
- **Block details**: the block colour circle (and USE GOAL COLOUR), name and description (editable only for laps with no recorded time), the plan line, the DID / ON TRACK NOW line, and **REMOVE FROM RACE**.
- **Laps to place**: drag a lap onto a day. Hover for × to delete.
- **TARGET FOR RACE N − / +** (session): a target for that one race only.
- **START MECHANICS SESSION** (Mechanics mode): asks to confirm, then ends the race.

**NEW LAP form**
- Name; goal chips (optional); start and end time.
- Length presets: up to five, **+** adds a custom one, hover shows × to remove one. They're saved on your profile.
- **REPEAT** (session only): EVERY DAY, WEEKDAYS or CHOOSE DAYS. Leave it unpicked for no repeat.
- **DAY**: NOT YET puts the lap in Laps to place.

## Tested in the browser
- **Driver:** recording a past lap by hand; block details.
- **Mechanics mode:** moving a lap twice (Thu → Fri → Sat) logs one entry, "Moved … · THU 26 13:00 → SAT 28 16:00". The unsaved prompt appears on switching modes.
- **Session block:** dragging it 1.5 hours earlier asks first and logs the move; Undo puts it back.
- **Views and forms:** the click-to-add form, SCROLL DAYS, and folding the panel.
- **Session:** CARRY / DROP, dragging a lap from Laps to place onto Monday, a repeating lap, and keeping or skipping one copy.
