# ITERACE

ITERACE is an F1-themed weekly study and goal planner. The full build spec is in **`docs/BUILD-BRIEF.md`**. Read it before any work, and read the relevant section again before each slice. The designs are in `docs/design/`: screenshots of every key state, plus the design tool's source files.

## Working with Lucy

- **Ask before major decisions.** That means new screens or features, data model changes, new dependencies, refactors across files, and anything hard to undo. Offer 2–3 concrete options with your recommendation, and wait for her answer.
- **Build one slice at a time**, in the order in section 11 of the brief. Finish and check each slice before starting the next.
- **Before coding:** read the relevant files, say what you found, describe the change, list the files you'll create or modify, and flag your assumptions. Small, obvious fixes can go ahead directly.
- **Never invent behaviour, fields or file paths.** If the brief, the designs and the repo don't answer something, ask.
- **Every finished screen gets a screenshot and a list of what each control does.** Add extra shots for states that look different.
- **Report what you actually tested.** Never call something fixed or working unless you ran it.
- **When Lucy changes a decision,** ask whether to update `docs/BUILD-BRIEF.md` in the same change.

## Hard rules

- **This repo is public.** Never commit secrets. Keep `.env.local` git-ignored. Only the Supabase anon key may reach the browser; never put the service-role key or calendar (iCal) links in client code.
- **Every table gets Row Level Security** (`user_id = auth.uid()`). Propose migrations to Lucy before applying them.
- **The design files are mock-ups.** Section 8 of the brief lists what not to copy from them.
