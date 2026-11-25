# ITERACE designs

These are exported from Lucy's design canvas (the latest version, 24 Nov 2026). The written rules are in `../BUILD-BRIEF.md`; when it and a picture disagree, the brief wins.

## Screens

Each screen is a static render at 1440×900. The mock's clock is frozen at **Wed 25 Nov 2026, 13:12**, during Race 04, and all of the data is sample data. Because the renders are static, a few things that depend on scrolling look slightly off. For example, some goal labels on the timeline overlap the names column.

The pink panels are correct: they're frosted white glass (74% white with a 26px blur) over the red page.

### Driver mode (during a race)

| File | What it shows |
|---|---|
| `01-home.png` | **Home.** The banner (date, countdown to the Mechanics session, race status, RACE PLAN link); the month calendar with the race band and day marks; today's laps in HOURS view. The running lap's row fills red as the timer counts down, with AUTO-END. There's also a dotted calendar event with **+ ADD** and **×**. |
| `02-home-onboard.png` | **ONBOARD.** The running lap full-screen: the timer, a progress track, AUTO-END, PAUSE and up next. |
| `03-home-race-plan.png` | **RACE PLAN.** The read-only brief from the last session: the focus, planned hours by day stacked by goal, planned vs target per goal, the subgoal in focus, and notes from the debrief. |
| `04-radio-log.png` | **Team Radio log.** This race's changes grouped by day, newest first. Each has a bold action with details underneath and an optional note. EMERGENCY PIT STOP is at the bottom. |
| `05-radio-emergency-pit-stop.png` | **Emergency pit stop.** Bring the Mechanics session earlier, or START NOW. |
| `06-race-week-driver.png` | **Race week, Driver mode.** The Sunday–Saturday hour grid with laps in goal colours, the start time faded in each block's corner, the goals panel with hours against targets, and the Mechanics session block on Saturday. |
| `07-race-week-mechanics-mode.png` | **Race week, Mechanics mode (mid-race).** Past hours are hatched and locked; planned hours sit faded behind each goal bar. SAVE and NEW LAP are in the top bar, and dotted repeat and calendar copies have + / ×. |
| `08-race-week-new-lap.png` | **NEW LAP form.** Name, optional goal, start and end time, length presets with a custom +, and the day. |
| `09-goals-timeline.png` | **Goals timeline** (MONTH scale). Goal bars run from start to deadline with chequered flags, subgoal lines sit underneath, and there's a TODAY line. View-only outside the session. |
| `10-goals-detail.png` | **A goal selected.** The detail panel: statement, D-day, races left, hours, weekly target, subgoals and SMART. |
| `11-goals-list.png` | **Goals LIST view.** Active and achieved cards. |

### Mechanics session (every page goes black carbon)

| File | What it shows |
|---|---|
| `12-session-radio-checklist.png` | **Session start.** The radio opens by itself, with the checklist (done in any order) above the race log. MECHANICS SESSION and BRIEF & START are in the header. |
| `13-session-home-debrief.png` | **Home becomes the debrief.** Laps done, hours vs planned vs targets, each goal's did / planned / target bar with a note, the radio notes, and "What got in the way?". |
| `14-session-race-week-carry-drop.png` | **Race week opens on carry/drop** for the unfinished laps, with CARRY ALL / DROP ALL. |
| `15-session-race-week-plan.png` | **Planning the next race.** Per-race targets, repeating laps (dotted with + / ×), Laps to place, and the UNFINISHED LAPS and EDIT GOALS buttons. |
| `16-session-goals.png` | **Goals during the session.** Editable, and NEW GOAL appears. |
| `17-session-brief.png` | **The brief overlay.** Focus, subgoal focus per goal, planned hours vs targets, debrief notes, and when the next race starts (or START NOW). |

## Source

`source/` holds the three artboards from the design tool: `HomeFromSpec.dc.html`, `RaceWeek.dc.html` and `Goals.dc.html`. They use the design tool's template format (`{{ … }}`, `<sc-if>`, `<sc-for>`, a `DCLogic` class), so they don't run in a browser as they are.

Read them for exact values: colours, sizes, spacing, wording, and how each interaction behaves. Don't copy their structure. The cross-page `localStorage` syncing, the frozen clock and the separate sample data on each page are all mock-only (brief, section 8).
