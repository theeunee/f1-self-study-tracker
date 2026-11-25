# Slice 5 · Team Radio

| Shot | State |
|---|---|
| `01-hover-line.png` | Hovering 📻: a Race Engineer line, and "click for this race's log" |
| `02-race-log-with-note.jpg` | The race log: grouped by day, newest first, UNDO on today's entries, a note under an entry |
| `03-emergency-pit-stop.jpg` | EMERGENCY PIT STOP (captured mid fade-in) |

The session version of the radio (Pit Wall with the checklist) is covered in slice 6.

## What each control does
- **📻** (bottom-left, every page): hover for a Race Engineer line, which cycles on each hover and uses your display name. Click to open or close the log.
- **?**: hover or focus to explain the log.
- **×** or **Esc**: closes the log.
- **UNDO** (today's entries only): the page that owns the change reverts it, and the entry disappears (it isn't struck through). It refuses if something changed the same lap since; undo the newer change first. Earlier days are read-only.
- **ADD NOTE / EDIT NOTE** (on hover): a one-line note, such as "couldn't focus". Enter saves. Notes feed the debrief.
- **Unsaved changes**: while Race week's Mechanics mode has a draft, it shows at the top with **SAVE**.
- **EMERGENCY PIT STOP** (live race only): pick TODAY or a later race day plus a time, then **MOVE SESSION** (earlier only, logged, can be undone today). Or **START NOW**, which ends the race at once and can't be undone. **CANCEL** closes it.

## Tested in the browser
- The hover line.
- Opening the log.
- Adding a note with Enter: it saved and shows.
- UNDO on "Moved Chapter 4" from the log: the lap went back, and the entry disappeared.
- Opening the pit stop.

Not yet seen working: one early note attempt didn't save. I couldn't reproduce it; every later try worked.
