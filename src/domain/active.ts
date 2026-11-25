// The "active" lap on Home and ONBOARD: the running lap, or the one you last timed today if it's paused
// (RESUME) or was just stopped by AUTO-END (KEEP GOING). Starting another lap makes that one active.
import type { DB, Lap } from '../data/types';
import { MIN, dayKey } from '../lib/time';
import { countedLaps, driverRace, lapPlacedStart, lapIsDone, recordedMs, runningTime } from './selectors';

export interface Active {
  lap: Lap;
  running: boolean;
  remainingMs: number; // negative = overtime
  autoEnded: boolean;
}

export function activeLap(db: DB, nowMs: number): Active | null {
  const run = runningTime(db);
  let lap: Lap | undefined;
  if (run) lap = db.laps.find((l) => l.id === run.lap_id);
  else {
    const today = dayKey(nowMs);
    const last = db.lap_times
      .filter((t) => t.how === 'timed' && t.ended_at && dayKey(t.ended_at) === today)
      .sort((a, b) => b.ended_at!.localeCompare(a.ended_at!))[0];
    if (last) {
      const l = db.laps.find((x) => x.id === last.lap_id);
      if (l && (l.status === 'planned' || l.status === 'done')) lap = l;
    }
  }
  if (!lap || lap.status === 'moved' || lap.status === 'dropped') return null;
  const rec = recordedMs(db, lap.id, nowMs);
  const remainingMs = lap.planned_min * MIN - rec;
  const autoEnded = !run && lap.auto_end && remainingMs <= 0;
  // A paused lap that was finished another way (e.g. marked complete) isn't active any more.
  if (!run && lap.status === 'done' && !autoEnded) return null;
  return { lap, running: !!run, remainingMs, autoEnded };
}

/** Laps on a given day, in time order (moved ones stay on their old day). */
export function lapsOnDay(db: DB, key: string): Lap[] {
  return db.laps
    .filter((l) => l.status !== 'dropped')
    .filter((l) => {
      const s = lapPlacedStart(db, l);
      return s && dayKey(s) === key;
    })
    .sort((a, b) => lapPlacedStart(db, a)!.getTime() - lapPlacedStart(db, b)!.getTime());
}

/** Next lap today that hasn't been done, after now. */
export function nextLapToday(db: DB, nowMs: number, exceptId?: string): Lap | undefined {
  return lapsOnDay(db, dayKey(nowMs)).find(
    (l) => l.id !== exceptId && l.status === 'planned' && !lapIsDone(db, l, nowMs) && recordedMs(db, l.id, nowMs) === 0,
  );
}

/** Lap number within the race, for ONBOARD's "LAP 6 OF 17". */
export function lapCounter(db: DB, nowMs: number) {
  const race = driverRace(db);
  const laps = countedLaps(db, race?.id).filter((l) => l.planned_start);
  const done = laps.filter((l) => lapIsDone(db, l, nowMs)).length;
  return { done, total: laps.length };
}
