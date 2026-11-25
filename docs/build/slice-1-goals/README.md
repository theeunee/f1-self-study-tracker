# Slice 1 · Goals

Screenshots were taken at 1440×900 with the sample data. The session shots use the dev clock (`?now=2026-11-28T19:05`), which starts the Mechanics session automatically.

| Shot | State |
|---|---|
| `01-timeline-driver.jpg` | Driver mode, MONTH scale, view-only |
| `02-list.jpg` | LIST view: active and achieved cards |
| `03-timeline-session.jpg` | Mechanics session: carbon look, NEW GOAL, black goal shown light grey |
| `04-new-goal-form.jpg` | New goal form with the SMART meter |
| `05-move-deadline.jpg` | Dragging a deadline later asks first |
| `06-history.jpg` | History: weekly bars, laps by week, deadline-moved mark |
| `07-detail-session.jpg` | Detail panel while the session is running (editable) |

## What each control does

**Page bar**
- **TIMELINE / LIST**: switches the view. Remembered in this browser.
- **WEEK / MONTH / QUARTER / YEAR**: changes the timeline scale. Every scale scrolls without limit. WEEK columns show the race number with the date underneath.
- **+ NEW GOAL** (session only): opens the SMART form.
- **VIEW ONLY · EDIT IN THE MECHANICS SESSION**: a label shown outside the session.

**Names column**
- **FILTER**: hides achieved goals and archived goals separately. Archived goals are hidden by default.
- **«**: folds the column to a strip of colour circles.
- **Chevron**: folds or unfolds a goal's subgoals.
- **Colour circle**: opens the colour board. Hover a swatch to remove it; **+** adds a custom colour with react-colorful. Works for the driver too.
- **Goal name**: click to select it and open the detail panel. Drag it to reorder (the row follows the cursor), or use Alt + ↑/↓.
- **Subgoal tick boxes**: tick a subgoal (session only).

**Track**
- **Goal bar**: click to select. The bar is solid up to today. A chequered flag and the date mark the deadline.
- **Bar end** (session only): drag right to move the deadline later. It asks first, then leaves a mark in the goal's history.
- **Subgoal line** (session only): drag to move it, drag either end to change its dates, click to edit.
- **Empty space** (session only): drag across it to draw a new goal, or drag inside a goal's row to add a subgoal.
- **📅** (bottom right): scrolls back to today.

**Detail panel**
- **Colour circle**: recolours the goal.
- **×**: closes the panel.
- **Weekly target − / +** (session only): steps by 30 minutes. Click the value to type `5`, `4.5`, `4h 30m` or `4:30`.
- **Subgoals**: tick, click the title to edit, hover for × to remove. The add row (title, FROM, TO) is session only.
- **EDIT GOAL**: opens the SMART form. Moving the deadline later asks first.
- **HISTORY**: all laps and total hours. Click a week bar to show only that week; **ALL RECORDS** goes back. **EXPORT AS .TXT** and **COPY TEXT** are underneath.
- **MARK ACHIEVED / REOPEN**, **ARCHIVE / UNARCHIVE**, and **DELETE**, which asks to confirm, offers ARCHIVE INSTEAD, and can be undone afterwards.

Every change made in the session goes to the race log and shows the Undo toast.
