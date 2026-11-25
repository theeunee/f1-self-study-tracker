# ITERACE — build brief for Claude Code

_Last updated 24 Nov 2026. Written from the design canvas and the build tracker. Where they disagree, this brief wins; where this brief is silent, ask Lucy._

> **Start here:** read this whole brief, look at the repo, then propose a plan for slice 0 (section 11): the setup, the folder structure and the first database migrations. Wait for Lucy's OK before writing code.

## 1. What we're building

ITERACE is a personal study and goal planner that replaces Lucy's Timestripe subscription, made fun with Formula 1 language and visuals. It is not trying to be groundbreaking. The weekly loop is the whole product:

1. **Set up goals.** Long-term goals, each with a weekly hour target.
2. **Plan the race.** A race is one week (Sunday to Saturday). Plan it as laps (study blocks) on an hour grid.
3. **Drive it.** Time laps live, log time done away from the screen, and move laps to later.
4. **Mechanics session.** Usually Saturday evening: review the race, decide what happens to unfinished laps, plan the next race, write a short brief, and pick when the next race starts.

The tone is guilt-free and "teaming up with future you". Overtime and missed laps are shown as facts, never as penalties.

### Reference material

- **Design canvas:** https://claude.ai/artifact/UvRznz3aUHsfL44NrQh533. It has three interactive artboards: `HomeFromSpec.dc.html` (Home), `RaceWeek.dc.html` (Race week) and `Goals.dc.html` (Goals). These are the visual and interaction source of truth. Click through them; most of what's described here can be tried there.
- **Build tracker:** https://claude.ai/artifact/XNaGtPjA8qUXg3EVKNGJjm. Every decision, with its status. Lucy also uses it to see progress.
- Both links are private to Lucy's account. If you can't open them, ask Lucy for exports or screenshots rather than guessing.

## 2. How to work with Lucy

These are her standing rules for any Claude working on ITERACE:

- **Ask before major decisions.** Before a new page structure, a new feature, a data model change, a new dependency, a refactor across files, or anything hard to undo, stop and ask with concrete options. Name your recommendation and say why.
- **Present two or three options, not one.** Don't quietly pick for her. Label things as Confirmed, Needs confirmation, Recommendation, Alternative or Future.
- **Work in small slices.** One screen or one behaviour at a time, finished and checked before the next. Her first attempt to build everything at once didn't work. Don't repeat that.
- **Before coding:** look at the relevant files, say what you found, describe the change, list the files you'll touch, and flag assumptions. A small, obvious fix can go ahead directly.
- **Don't invent APIs, fields, file paths or behaviour.** Check the repo, this brief or the designs. If none of them answers it, ask.
- **Debugging:** separate evidence from guesses, rank the likely causes, and suggest the smallest test that tells them apart. Never call a fix verified unless you actually tested it.
- **Challenge weak ideas.** Say plainly when something is redundant, overcomplicated or conflicts with a decision. Then let her choose.
- **Every finished screen gets a screenshot plus a list of what each control does.** Include extra shots for states that look different (empty, error, running, session).

## 3. Stack and foundations

| Area | Decision |
|---|---|
| App | Web app first: **React + TypeScript + Vite**. Wrapped as a desktop app later. |
| Layout | **Desktop-first.** Designed at 1440×900. A phone layout comes later, so keep components flexible, but don't build mobile now. |
| Accounts and data | **Supabase**: Postgres, Auth (email plus Google sign-in) and Row Level Security. Everyone sees only their own records. The app works online for now; offline sync is a later upgrade, so keep the data model friendly to it (UUIDs, `created_at`/`updated_at`, soft deletes where noted). |
| Repo | `theeunee/f1-self-study-tracker` (public). **Never commit secrets.** `.env.local` goes in `.gitignore`. Only the Supabase anon key may reach the browser; the service-role key never does. |
| Open source | Yes. That's another reason to keep secrets out of the repo. |
| Colour picker | `react-colorful` (settled for now). |
| Fonts | Orbitron (display), IBM Plex Sans (body), IBM Plex Mono (labels), all from Google Fonts (settled for now). |
| Calendar sync | Read-only, from Google's and Apple's private iCal links. Browsers usually can't fetch those directly, so use a Supabase Edge Function as a small proxy. Treat the iCal URLs as secrets: store them server-side, not in the client. |

Before other people use it, three things are required: a privacy policy, account deletion (which removes all of a user's rows), and RLS on every table. Supabase free projects pause after about a week of low activity. That's fine for development; move to a paid plan once others rely on it.

## 4. Words

| Word | Meaning |
|---|---|
| **Race** | One week, Sunday to Saturday. Numbered per user (Race 01, 02, …). It starts at the time picked in the brief and ends when the Mechanics session starts, so races can stretch or shrink. |
| **Lap** | One planned task or study block on the grid. It has a title, an optional goal, an optional description, a planned start and a planned length. |
| **Lap time** | The time actually recorded on a lap: timed live, or logged by hand. |
| **Goal** | A long-term goal with a start date, a deadline and a weekly hour target. There are no separate "weekly goals". |
| **Subgoal** | A smaller step inside a goal, with its own start and end dates. |
| **Laps to place** | The tray of laps not yet put on the grid, such as carried laps. |
| **Driver mode** | The normal state during a race: doing the laps. |
| **Mechanics mode** | A mid-race edit mode on **Race week only**, for small changes to the rest of this race. The look stays light. |
| **Mechanics session** | The weekly review and planning session (Saturday 19:00 by default). Every page goes dark ("garage" look) while it runs. |
| **Team Radio** | The 📻 button in the bottom-left of every page. Hover for a Race Engineer line; click for the race log (and the session checklist during a session). |
| **Emergency pit stop** | Bringing the Mechanics session earlier, or starting it now. Never later. |
| **D-day** | The countdown on Home and Race week. It shows the Mechanics session by default, or a custom date such as an exam. |

## 5. Rules of the loop

**Race timing**
- Races run Sunday to Saturday everywhere: calendars, race bands, planners.
- The Mechanics session is **Saturday 19:00 by default**. It starts when its time arrives. If the app was closed then, it starts as soon as the app opens: the race ends at the session time.
- It can only move **earlier**, never later. Two ways to do that: **EMERGENCY PIT STOP** in the radio (pick an earlier time, or START NOW), or dragging the session block earlier in Race week's Mechanics mode.
  - Both show a warning that the race ends when the session starts, and the drag says how many laps would become unfinished.
  - Moving the session earlier is logged and can be undone today. Starting it can't be undone.
  - Pushing the session later is a future idea. Don't build it.
- **Starting the session ends the race.** The running lap stops (its time is kept) and ONBOARD closes.

**During a race (Driver mode)**
- **Home:** start, pause and resume laps; LOG TIME by hand; add or dismiss calendar events.
  - **MOVE TO LATER** picks a later day in this race and a start time. The lap stays on its old day marked as moved. If it was running, the timer stops and its time is kept.
- **There's no NEW LAP in Driver mode.** New laps are added in Mechanics mode. The one exception is adding a calendar event.
- **Race week:** a past lap that was never timed gets a checkbox to record its time by hand.
- **Goals is view-only.** The driver can still change goal colours, reorder rows, fold, filter, zoom and open history.
- **Every change goes to the race log.** Changes made on Home and the Race week checkbox are logged straight away. Race week's Mechanics mode logs on SAVE, as net changes.

**Mechanics mode (mid-race, Race week only)**
- Edits only the **rest of this race**. Past days, and the hours already gone today, are blacked out (lightly) and can't be edited.
- What you can do:
  - add laps: NEW LAP, click an empty slot, or drag down an empty slot
  - move them and change their length (snapping to 15 minutes)
  - place laps from Laps to place, or delete laps there
  - drag the session block earlier
- Only laps with no recorded time can move. Any block can be clicked to see its details.
- Repeats are **not** offered mid-race; only in the session.
- Changes are a draft until **SAVE**. Switching back to Driver mode with unsaved changes asks: SAVE / DISCARD / KEEP EDITING.
- **The log keeps the net change only.** If Chapter 4 moves Thu → Fri → Sat, then SAVE, the log says "Moved Chapter 4 · Thu → Sat".
- Unsaved changes also show at the top of the radio log, with a SAVE button.

**Timer**
- It **counts down** the lap's remaining time. Overtime shows calmly as `+MM:SS`, with no penalty.
- **AUTO-END** is ticked by default. The lap stops once its planned length has been timed; pauses don't count. KEEP GOING carries on past it.
  - Unticked, it keeps recording overtime until stopped, and the block grows to match.
- The running lap's row is the timer: it fills with red as time passes. There's no floating timer box.

**Radio log**
- Covers this race only, grouped by day, **newest first**.
- Each entry has a bold action ("Moved Practice test") with its details underneath, and the page it happened on.
- **Today's entries can be undone; earlier days are read-only.**
  - Undone entries disappear, whether they were undone from the log or from the pop-up Undo toast. They are never struck through.
  - The page that owns the change reverts it.
- Any entry can have a note, such as "couldn't focus, short on sleep". ADD NOTE and EDIT NOTE show on hover. Notes feed the debrief.
- A `?` next to the title shows the explanation on hover.

**Goals**
- Only the Mechanics session can edit goals: create, edit, set weekly targets, add or edit subgoals, archive, mark achieved, delete, move a deadline, or drag subgoals.
- Moving a deadline later asks first and **leaves a mark in the goal's history**. This applies both to dragging the bar's end and to EDIT GOAL.
- Achieved goals drop EDIT GOAL, THIS RACE, the weekly target and the subgoals section.
- Archived goals are hidden from the timeline by default (the filter can show them) and listed under ARCHIVED.
- Delete asks to confirm and suggests ARCHIVE instead, then offers Undo. The goal's laps keep their recorded time but count toward **no goal** (settled for now).
- Weekly targets live on the goal. The session can also set a different target for one race.

**Calendar events**
- They show dotted on the grids. **+** adds one as a lap with **no goal**; give it a goal later in the lap editor. **×** dismisses it. Both are logged and can be undone (settled for now).
- Time with no goal appears as "No goal" in the debrief.

## 6. Pages

The designs are the source of truth for layout and styling. This section covers the behaviour each page needs.

### Shared shell
- **Header:** ITERACE wordmark; page tabs (HOME · RACE WEEK · GOALS); right-side status.
- **Background:** the red page (#E10600) with frosted-glass panels in Driver mode.
- **Radio:** bottom-left on every page.
- **Today:** a calendar icon bottom-right jumps back to today.
- **Undo toast:** after most changes. It keeps only the last change.

### Home (Driver)
- **Banner:** today's date, the D-day countdown (hover to edit: switch to a custom D-day; the session can't be removed), and the race status with a RACE PLAN link.
- **Month calendar:** scrolls endlessly, with no visible scrollbar. The current race is one continuous band starting Sunday. Per-day marks show time recorded, all laps done and the Mechanics session day. Clicking a day shows its laps.
- **Laps panel:** HOURS (default) or LIST.
  - **Header:** the day total and a pill, e.g. `3 OF 3 DONE · 2h 5m / 2h` followed by `+5M OVER`. Pill styles: ON PLAN is black, OVER is red, UNDER is outlined.
  - **List rows:** expand to show START LAP / LOG TIME / MOVE TO LATER, the description, and the recorded times in time order.
  - **Recorded times:** each can be edited or removed on hover, today only.
  - **Hours view:** hovering a lap shows LOG TIME and MOVE TO LATER.
- **Draggable divider** between the calendar and the laps panel, with arrow keys too.
- **LOG TIME dialog:** start, finish, and a MARK AS COMPLETE box. EDIT mode adds REMOVE THIS TIME.
- **ONBOARD:** a full-screen black view of the running lap: big timer, progress track, AUTO-END, PAUSE, up next, a radio line. With nothing running it shows the current time (with seconds). START NEXT LAP first shows the lap's goal, title, planned time and description, with START LAP / NOT YET. Esc closes it.
- **RACE PLAN:** the read-only brief written in the last session:
  - one focus
  - hours by day, stacked by goal, with the total planned underneath
  - planned vs target per goal
  - the subgoal in focus for each goal
  - notes from the last debrief

### Race week
- **Hour grid:** Sunday to Saturday, 07:00–23:00, with laps in goal colours.
  - Blocks show the title only, with the start time faded in the top-right corner. Clicking a block opens its details under the goals panel: the goal name, a colour circle (each block can have its own colour), the planned day and time, and then the actual time ("DID 13:30–14:45" or "ON TRACK NOW · 12m SO FAR").
  - A lap sits on the grid where it actually happened.
- **Left panel:**
  - Each goal's hours this race against its target. In Mechanics mode, the planned hours show at 50% opacity behind.
  - Click a goal's dot to recolour it.
  - The panel can fold into small pie circles to widen the grid.
- **Range:** THIS RACE, or SCROLL DAYS (endless sideways scrolling, Driver mode only).
- **Countdown:** the same D-day as Home, kept in sync.
- **Modes:** the header toggles DRIVER MODE ⇄ MECHANICS MODE. Mechanics mode is described in section 5. The SAVE button sits in the top bar.
- **NEW LAP form:**
  - lap name, optional goal, day, and start and end time
  - length presets: 30M, 1H, 90M and 2H to start, up to five. **+** adds a custom one; hovering a preset shows **−** to remove it.
  - repeat: every day, weekdays or chosen days. It's only offered in the Mechanics session, and leaving it unpicked means no repeat.
- **Repeating laps:** each copy shows dotted. **+** keeps that day's copy and **×** skips it.
- **Colour board:** one editable board of eight defaults plus custom colours. Hover a colour to remove it; **+** adds one via `react-colorful`.

### Goals
- **TIMELINE / LIST** toggle.
- **Timeline:**
  - scales: WEEK / MONTH / QUARTER / YEAR, each scrolling without limit
  - week columns show the race number on top and the date below
  - a TODAY line, and a chequered flag at each deadline
- **Goal rows:**
  - a bar from start to deadline, solid up to today
  - subgoals as thin lines under the bar, labelled with their dates. They can overlap and fold, even when the names column is folded.
  - in the session: drag a subgoal line to move it, drag either end to change its dates, click to edit it
  - drag across empty space to draw a new goal, or inside a goal's row to add a subgoal (session only)
- **Names column:**
  - folds to a narrow strip of colour circles
  - click any circle to change the colour (allowed for the driver too)
  - drag a name to reorder; the row follows the cursor
  - a filter hides achieved and archived goals separately
- **Detail panel** (only while a goal is selected):
  - the statement, D-day and races left, this race's hours, total logged
  - the weekly target: − / + or type it (`5`, `4.5`, `4h 30m`, `4:30`)
  - subgoals with ticks
  - a SMART breakdown
  - actions: EDIT GOAL, HISTORY, MARK ACHIEVED / REOPEN, ARCHIVE, DELETE
- **New-goal form:** walks through SMART (name, colour, S, M, A, R, a Time-bound date, weekly target). A five-letter meter lights up as each part is filled. Name, date and target are required.
- **History:**
  - shows all laps and total hours by default
  - the coloured card's weekly bars are clickable to show one week, and the title switches between ALL RECORDS and e.g. `WEEK · 18–24 OCT` with `3h 5m · 6 LAPS`
  - deadline moves appear as marks
  - EXPORT AS .TXT and COPY TEXT
- **List view:** ACTIVE / ACHIEVED / ARCHIVED groups, each of which folds.
  - Active cards show the due date, weekly target, this race, subgoals and SMART.
  - Achieved cards show start → achieved, races taken, weekly average, total and SMART score (e.g. `5 / 5`).
  - Archived cards show start → archived, weekly target, total logged, subgoals and SMART score.

### Mechanics session (all pages)
- **Starts** at the scheduled time, from START MECHANICS SESSION on Race week (asks to confirm), or from EMERGENCY PIT STOP → START NOW.
- **Look:** every page switches to the **black carbon look**. Panels are dark glass, text is off-white, red stays for actions. Race week's mid-race Mechanics mode does **not** use this look. The radio pop-out gets a red outline and glow so it stands out on the dark background.
- **Header right side:** a MECHANICS SESSION label and a **BRIEF & START** button, which opens the brief over any page.
- **Radio:** opens by itself on every page and shows a **checklist done in any order**:
  - Debrief (Home)
  - Unfinished laps (Race week)
  - Plan next race (Race week)
  - Brief & start (overlay)

  Each item has a tick box you tick yourself, a status line (e.g. "9 still to carry or drop", "5h 45m planned of 14h in targets"), a GO / OPEN button, and a YOU'RE HERE tag where you are. The race log sits underneath.
- **Home = Debrief:**
  - laps done, hours vs planned, hours vs targets
  - per goal, a did / planned (faded) / target bar with an optional note
  - the radio notes
  - an optional "What got in the way?" box
- **Race week:**
  - **Opens on carry/drop:** every unfinished lap of the ending race gets CARRY or DROP, plus CARRY ALL / DROP ALL.
    - Carrying puts the lap into Laps to place straight away, with only the time it had left.
    - Dropping a carried lap also takes it off the new plan.
    - You don't have to decide every lap.
  - **Reopening it:** PLAN RACE N → closes it, and an UNFINISHED LAPS button reopens it.
  - **Planning the next race:** NEW LAP (repeats allowed), each goal's target for that race, and EDIT GOALS.
- **Goals:** fully editable during the session.
- **Brief overlay:**
  - one focus
  - one subgoal in focus per goal
  - planned hours per goal (from the plan) against its target
  - the debrief notes
  - the start: SUN / MON plus a time, or START NOW. Starting the race ends the session.

## 7. Data model (first sketch, to confirm with Lucy)

Every table has `user_id uuid references auth.users` and an RLS policy of `user_id = auth.uid()`, plus `created_at` and `updated_at`. Use `timestamptz` for moments and display them in the user's time zone. Propose the actual migrations to Lucy before applying them.

| Table | Key fields |
|---|---|
| `profiles` | `id` (= auth uid), `display_name`, `timezone`, `session_weekday` (default 6 = Sat), `session_time` (default 19:00), `colour_board text[]`, `length_presets int[]` (default 30, 60, 90, 120) |
| `goals` | `name`, `color`, `status` (active / achieved / archived), `start_date`, `due_date`, `weekly_target_min`, `smart_s`, `smart_m`, `smart_a`, `smart_r`, `sort_order`, `achieved_on`, `archived_on`, `deleted_at` |
| `goal_marks` | `goal_id`, `kind` (deadline_moved), `from_date`, `to_date`, `made_on` |
| `subgoals` | `goal_id`, `title`, `start_date`, `due_date`, `done` |
| `races` | `number`, `starts_at`, `session_at` (scheduled), `ended_at`, `status` (planned / live / in_session / done) |
| `race_targets` | `race_id`, `goal_id`, `target_min` (a one-race override) |
| `laps` | `race_id`, `goal_id` (nullable), `title`, `description`, `planned_start` (null = in Laps to place), `planned_min`, `color` (nullable override), `auto_end` (default true), `status` (planned / done / moved / dropped), `source` (manual / repeat / calendar / carried), `moved_from_lap_id`, `carried_from_lap_id` |
| `lap_times` | `lap_id`, `started_at`, `ended_at` (null while running), `how` (timed / by_hand). Pausing closes the current row; resuming opens a new one. |
| `repeat_rules` | `goal_id`, `title`, `days int[]`, `start_time`, `length_min`, `from_date`, `until_date` |
| `repeat_choices` | `rule_id`, `date`, `choice` (kept / skipped), `lap_id` |
| `calendar_sources` | `provider`, `name`, `ics_url` (server-side only) |
| `calendar_choices` | `source_id`, `event_uid`, `date`, `choice` (added / dismissed), `lap_id` |
| `countdowns` | `name`, `date`, `time` (nullable), `selected`. The session countdown is built in, not a row. |
| `log_entries` | `race_id`, `page`, `kind`, `main`, `detail`, `payload jsonb` (before / after, for undo), `undone`, `note` |
| `debriefs` | `race_id`, `why`, `goal_notes jsonb` |
| `briefs` | `race_id` (the race being planned), `focus`, `subgoal_focus jsonb`, `start_at` |
| `carry_choices` | `race_id`, `lap_id`, `choice` (carry / drop) |
| `session_checks` | `race_id`, `debrief`, `unfinished`, `plan`, `brief` (booleans) |

## 8. In the designs, but mock-only (don't copy)

- **The frozen clock:** "Wed 25 Nov 2026, 13:12:08", and the hard-coded Race 04 / Race 05 numbers and dates. The real app uses real time and real races.
- **Separate sample data on each page.** The three artboards don't share data. In the app it's all one database.
- **Cross-page syncing** through `localStorage` keys (`iterace.audit.v1`, `iterace.ddays.v1`, `iterace.session.v1`) and `postMessage`. Replace it with the database, plus Supabase Realtime if live updates across tabs are needed.
- **"Mock only" buttons:** the × that ends the session, and "finishing returns you to Race 04".
- **Hard-coded subgoal options** in the brief, the seeded log entries, and the goal names typed into Home's code.
- **Static strings** like `03D 05H 47M`; compute them.
- **The dark theme mechanism.** The designs switch it with CSS variables on a `data-garage` attribute. Reusing the idea as proper theme tokens (light / session) is fine; copying the mock's code is not.

## 9. Visual tokens (from the designs)

| Group | Values |
|---|---|
| Red and ink | Red `#E10600`; red text `#C20500`; ink `#111111`; greys `#2B2B2B`, `#3F3F3F`, `#6B6B6B` |
| Panels | Frosted white `rgba(255,255,255,0.74)` with a 26px backdrop blur on the red page; 4px corners for panels, dialogs and blocks; buttons and chips fully round; 1px block borders. Block text is normal weight and turns bold when selected. |
| Session (dark) | Carbon page (`#1E1E22` → `#0F0F11` with a fine weave); off-white text `#F2F2F4`; dark glass panels `rgb(30,30,34)`; red text `#FF5B50`; radio pop-out `rgb(46,46,53)` with a red outline and glow |
| Type | Orbitron 900 for big numbers and titles; IBM Plex Mono for uppercase labels (letter-spacing about 0.1–0.16em); IBM Plex Sans for body text |
| Goal colours | `#E10600`, `#111111`, `#7A3CE0`, `#00A86B`, `#F5B700`, `#1C64F2`, `#0E9FA6`, `#E6007E`, plus custom. Show a black goal as light grey on the dark session theme. |
| Motion | Light, for now: short fades and slides, the filling timer row, rows sliding when reordered |

## 10. Settled for now (can be revisited)

1. The timer counts down; overtime shows as `+MM:SS` with no penalty.
2. A calendar event added with **+** has no goal until you give it one.
3. Colour picker: `react-colorful`.
4. Deleting a goal: confirm (suggesting ARCHIVE instead), then Undo. Its laps keep their time under "No goal".
5. Fonts: Orbitron with IBM Plex. A broadcast-style display font may be tried later.
6. Development data: a seed script creates a sample race; real laps come from Race week.
7. Home fits one screen, as drawn, with no below-the-fold sections.
8. Week "sectors" and table/card views of the week are out.
9. Motion stays light. The September three-tier motion language is parked.

**Cut for good:** courses, modules, assignments, submissions and grading. Goals replace them.

**Future, don't build now:** pushing the session later, pausing a race (sick days, travel), fixing a forgotten record, a season-card image export, season stats, Google two-way sync, offline sync, and the phone layout.

## 11. Build order

Build one slice at a time. Each ends with a screenshot, the list of controls, and Lucy's OK.

0. **Foundations.** Vite + React + TS; routing for Home, Race week and Goals; Supabase project (development); `.env.local`; sign-in (email and Google); the tables needed so far, with RLS; theme tokens and fonts; the app shell (header, tabs, red background, glass panels); the seed script.
1. **Goals.** Timeline (start with the MONTH scale), list view, detail panel, the SMART form, subgoals, archive / achieve / delete, colours, reordering.
   - Put editing behind one `canEdit` flag. For now it's always on; slice 6 ties it to the session.
2. **Race week (Driver).** The Sunday–Saturday hour grid from the database, block details, time tags, the goals panel, folding, the countdown, SCROLL DAYS, and recording untimed laps by hand.
3. **Race week (Mechanics mode).** NEW LAP, click- and drag-to-create, move and resize, Laps to place, the blackout, SAVE / DISCARD with net-change logging, and dragging the session block earlier.
4. **Home.** Banner and countdown, the month calendar with the race band, the laps panel (HOURS / LIST), the timer (count down, auto-end, pause, overtime), LOG TIME, MOVE TO LATER, the day pill, the divider, ONBOARD, and RACE PLAN.
5. **Radio.** Hover lines, the race log with undo (today) and notes, unsaved-changes display, and the emergency pit stop.
6. **Mechanics session.** Start and end, the timer stopping, the session theme, the radio checklist, the Home debrief, carry/drop, planning the next race (repeats, per-race targets), unlocking Goals, the brief, and starting the next race.
7. **Extras.** Calendar sync (Edge Function proxy, dotted events, add / dismiss), goal history with export, and the colour board.
8. **Later.** The future list in section 10.

When a slice touches something this brief doesn't cover, ask before building it.
