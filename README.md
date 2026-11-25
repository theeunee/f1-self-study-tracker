# ITERACE

An F1-themed weekly study and goal planner. Set long-term goals, plan each week as a race of laps, drive it, then review and plan the next one in the Mechanics session. The build spec is in [`docs/BUILD-BRIEF.md`](docs/BUILD-BRIEF.md); what was built, with screenshots per slice, is in [`docs/build/`](docs/build/README.md).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. With no Supabase keys the app runs in **local mode**: everything is saved in this browser, and you can load a sample race from the welcome screen or the account menu.

### Connect Supabase (development project)

1. Create a project, then run `supabase/migrations/0001_init.sql` (SQL editor, or `supabase db push`). It creates every table with Row Level Security (`user_id = auth.uid()`), keeps iCal links unreadable from the browser, and adds `delete_my_account()`.
2. In Authentication, turn on Email and Google sign-in, and add `http://localhost:5173` to the redirect URLs.
3. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Only the anon key goes to the browser. `.env.local` is git-ignored.
4. For calendar sync, deploy the Edge Function:

```bash
supabase functions deploy calendar
```

5. Optional: to fill your account with the sample race, add `SUPABASE_SERVICE_ROLE_KEY` and `SEED_USER_EMAIL` to `.env.local`, sign in once, then:

```bash
npm run seed
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests: the race loop, undo rules, carry/drop, the iCal parser |
| `npm run typecheck` | TypeScript |
| `npm run build` | Typecheck and production build |
| `npm run seed` | Sample data into Supabase for one user (uses the service role key, on your machine only) |

## Dev clock

In development, add `?now=2026-11-28T19:05` to any URL to move the app's clock, for example to see the Mechanics session start. It stays for the tab; `?now=real` resets it, and the footer shows DEV CLOCK while it's on. It doesn't exist in production builds.

## Structure

```
src/
  data/        store (in-memory rows, write-through to Supabase or this browser), types, seed, auth
  domain/      race lifecycle, laps and timer, goals, repeats, calendar, read-side selectors
  shell/       header, tabs, background, toast, account menu
  pages/       home/, raceweek/, goals/
  radio/       Team Radio, race log, pit stop, Race Engineer lines
  session/     debrief, brief, carry/drop
  ui/          shared dialogs, colour board, countdown, log-time dialog, icons
  styles/      theme tokens (light / session) and base styles
supabase/
  migrations/  0001_init.sql
  functions/   calendar (iCal proxy) and _shared/ics.ts
```
