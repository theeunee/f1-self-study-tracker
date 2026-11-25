# Slice 6 · Mechanics session

The whole loop was run in the browser with the dev clock: Race 04 was live; at Sat 28 Nov 19:05 the session had started on its own; Race 05 was started from the brief for Sun 29 09:00; at Sun 29 09:05 Race 05 was live.

| Shot | State |
|---|---|
| `01-session-starts-pit-wall.jpg` | Session start: carbon theme, MECHANICS SESSION + BRIEF & START in the header; the radio opens by itself with the checklist; Home is the debrief |
| `02-debrief.jpg` | Debrief: laps done, hours vs planned, vs targets; per goal did / planned / target with a note; radio notes; "What got in the way?" |
| `03-carry-all.jpg` | Race week opens on carry/drop; CARRY ALL logged as one undoable entry; checklist says "Every lap decided" |
| `04-brief.jpg` | Brief: focus, subgoal per goal, planned vs target, debrief notes, start day/time or START NOW |
| `05-after-start-planned.jpg` | After START RACE 05 · SUN 29 09:00: back to the red theme, header "RACE 05 · STARTS SUN 29 09:00" |
| `06-next-race-live.jpg` | Sun 29 09:05: Race 05 on track, the band moved to the new week |

## How the session starts and ends
- **Starts** at the scheduled time by itself (even if the app was closed: the race ends at the session time). It can also start from START MECHANICS SESSION in Race week's Mechanics mode (asks to confirm), or EMERGENCY PIT STOP → START NOW.
- **Starting it ends the race.** A running lap stops at the session time and keeps its time. Race N+1 is created to plan, with a provisional start of the next Sunday at 09:00.
- **Ends** from the brief: START RACE N at a SUN/MON time, or START NOW. The next race keeps the planned week's session (Saturday 19:00 by default), so a race started early stretches instead of ending before its own plan. It goes live at its start time and logs "Race N started".

## What each control does
- **BRIEF & START** (header): opens the brief over any page.
- **Checklist** (radio, any order): tick each item yourself. GO → goes to Home or Race week, and OPEN opens the brief. YOU'RE HERE marks the item for your current page. Starting a race from the brief ticks "Brief & start".
- **Debrief** (Home): a note per goal and "What got in the way?". Both save as you type and show in the brief and in the next race's RACE PLAN. **NEXT · UNFINISHED LAPS →** goes to Race week.
- **Carry / drop** (Race week): CARRY puts the lap into Laps to place with only the time it had left; DROP takes a carried copy off the new plan. CARRY ALL / DROP ALL count as one undo. Not every lap needs a decision. **PLAN RACE N →** closes it; **UNFINISHED LAPS · N LEFT** reopens it.
- **Planning** (Race week): NEW LAP with repeats, a TARGET FOR RACE N per goal, EDIT GOALS, drag from Laps to place. Every change saves at once with Undo.
- **Goals**: fully editable while the session runs.
- **Brief**: the focus field, one subgoal chip per goal (click again to clear it), SUN / MON plus a time, **START NOW**, and **START RACE N · day time**.

The mock's × button that ended the session isn't built (brief §8).
