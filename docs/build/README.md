# ITERACE build log · 24–25 Nov 2026

Everything in brief §11, slices 0–7, is built, on branch `build/iterace-v1` (pushed; no pull request yet). Each slice has its own folder with screenshots and a list of what each control does:

| Slice | Folder | State |
|---|---|---|
| 0 Foundations | (this file) | Vite + React + TS, routing, data layer, schema with RLS, sign-in, theme, shell, seed |
| 1 Goals | [`slice-1-goals/`](slice-1-goals/README.md) | Built and checked in the browser |
| 2–3 Race week | [`slice-2-3-race-week/`](slice-2-3-race-week/README.md) | Built and checked in the browser |
| 4 Home | [`slice-4-home/`](slice-4-home/README.md) | Built and checked in the browser |
| 5 Radio | [`slice-5-radio/`](slice-5-radio/README.md) | Built and checked in the browser |
| 6 Mechanics session | [`slice-6-session/`](slice-6-session/README.md) | Full loop run end to end in the browser |
| 7 Extras | [`slice-7-extras/`](slice-7-extras/README.md) | Built; the Edge Function isn't deployed or run |

`npm test` runs 15 tests (the race loop, undo, carry/drop, the iCal parser). They pass in the Los Angeles, Tokyo and London time zones. `npm run build` passes.

## What I couldn't test
- **Supabase.** There's no project or keys here. The migration, sign-in (email link and Google), Row Level Security, the Supabase adapter, account deletion, the `calendar` Edge Function and `npm run seed` were written against Supabase's documented APIs but haven't run once. Everything in the screenshots runs on **local mode** (data in the browser), using the same store and the same domain code.
- Screen readers and keyboard-only use throughout, beyond spot checks (dialogs move and return focus; Esc closes dialogs; goal reorder works with Alt + arrows; the divider works with arrow keys).

## Decisions I made without asking (you allowed this for tonight). Please check these.
1. **Local mode instead of blocking on Supabase.** With no keys, the app keeps data in the browser and offers sample data. With keys, the same code writes to Supabase. That needs no new screens, apart from a sign-in page and a first-run "What should your race engineer call you?"
2. **Data layer.** On sign-in, all of your rows load into memory (one person's planner is small), and every change writes through. Every logged change stores the before/after rows, so undo is generic, and it refuses if the same row changed again afterwards.
3. **First race for a new account.** It starts the moment you finish setup and ends at the next Saturday 19:00. The brief doesn't say how Race 01 begins.
4. **Next race's provisional dates.** When a session starts, Race N+1 is created to plan into, starting the next Sunday at 09:00. The brief can change that (SUN / MON + time, or START NOW).
5. **START NOW keeps the planned week's session.** A race started early stretches until the session it was planned around, instead of ending this Saturday (brief §4: "races can stretch or shrink").
6. **"Active" lap on Home and ONBOARD.** That's the running lap, or the lap you last timed today if it's paused (RESUME) or just auto-ended (KEEP GOING).
7. **HOURS view:** clicking a lap opens it in LIST view (for START / PAUSE). The designs only show hover buttons there.
8. **Account menu** (initial in the header, far right). It holds CALENDARS, LOAD SAMPLE DATA (local), SIGN OUT and DELETE ACCOUNT. It isn't in the designs, but account deletion is required (brief §3) and calendars needed a home.
9. **Delete goal** offers ARCHIVE INSTEAD next to DELETE (brief §5). The design's dialog only had CANCEL / DELETE.
10. **Planned hours** count only laps placed on the grid, not laps waiting in Laps to place.
11. **Record by hand** (the Race week checkbox) only shows while that lap's race is live. Fixing a record afterwards is on the future list.
12. **Router.** I switched to React Router's data router so Race week can stop you leaving with unsaved Mechanics-mode changes (SAVE / DISCARD / KEEP EDITING).
13. **Old files left alone.** `.next/` and `next-env.d.ts` from the August Next.js attempt are git-ignored, not deleted. `docs/ITERACE.md` (the older spec with courses) is untracked and unchanged. The `iterace-testing` skill still describes that old spec (CTO briefing, courses), so I followed its spirit (behaviour tests) rather than its list.

## Known gaps and small things
- Once, a radio note didn't save; I couldn't reproduce it, and later tries all worked.
- Once, after adding a calendar event, the Race week grid scrolled back to 07:00; I couldn't reproduce it either.
- The production bundle is about 506 kB (155 kB gzipped). Vite warns about size; code-splitting can come later.
- Not built, as the brief says: pushing the session later, pausing a race, fixing a forgotten record, the season-card image, season stats, Google two-way sync, offline sync, the phone layout.
