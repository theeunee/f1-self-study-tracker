// Race lifecycle (brief §5): races start at the time picked in the brief, end when the
// Mechanics session starts, and the session can only ever move earlier.
import type { Store, Tx } from '../data/store';
import type { Race } from '../data/types';
import { MIN, addDays, atTime, fmtDayTime, now, startOfWeek } from '../lib/time';
import {
  driverRace,
  lapsOf,
  liveRace,
  nextRaceAfter,
  profileOf,
  raceName,
  racesSorted,
  recordedMs,
  runningTime,
  sessionAfter,
  sessionRace,
  sessionSlot,
  upcomingRace,
} from './selectors';

/** Close the running timer at `at` (never before it started). */
export function stopRunning(t: Tx, at: Date) {
  const r = runningTime(t.db);
  if (!r) return;
  const start = new Date(r.started_at).getTime();
  const end = Math.max(start, at.getTime());
  t.update('lap_times', r.id, { ended_at: new Date(end).toISOString() });
}

/** Provisional start for the race after a session at `sessionAt`: the next Sunday, 09:00. */
export function defaultNextStart(sessionAt: Date): Date {
  return atTime(addDays(startOfWeek(sessionAt), 7), '09:00');
}

function ensureNextRace(t: Tx, race: Race, sessionAt: Date): Race {
  const existing = nextRaceAfter(t.db, race);
  if (existing) return existing;
  const startsAt = defaultNextStart(sessionAt);
  return t.insert('races', {
    number: race.number + 1,
    starts_at: startsAt.toISOString(),
    session_at: sessionAfter(startsAt, sessionSlot(t.db)).toISOString(),
    ended_at: null,
    status: 'planned',
  });
}

/** Starting the session ends the race: the running lap stops (its time is kept). */
export function beginSession(t: Tx, race: Race, at: Date) {
  stopRunning(t, at);
  t.update('races', race.id, { status: 'in_session', ended_at: at.toISOString() });
  ensureNextRace(t, race, at);
  if (!t.db.session_checks.some((c) => c.race_id === race.id)) {
    t.insert('session_checks', { race_id: race.id, debrief: false, unfinished: false, plan: false, brief: false });
  }
}

/** EMERGENCY PIT STOP → START NOW, or START MECHANICS SESSION on Race week. Can't be undone. */
export function startSessionNow(store: Store, via: 'pit' | 'week') {
  const race = liveRace(store.db);
  if (!race) return;
  const at = now();
  const t = store.tx();
  beginSession(t, race, at);
  t.commit();
  // Logged without undo data: starting the session can't be undone (brief §5).
  const l = store.tx();
  l.insert('log_entries', {
    race_id: race.id,
    page: via === 'pit' ? 'home' : 'week',
    kind: 'session-start',
    main: via === 'pit' ? 'Called an emergency pit stop' : 'Started the Mechanics session',
    detail: `session started now instead of ${fmtDayTime(race.session_at)}`,
    payload: null,
    undone: false,
    note: '',
  });
  l.commit();
}

/** Bring the session earlier. Logged and undoable today. */
export function moveSessionEarlier(store: Store, to: Date, page: 'home' | 'week' | 'goals') {
  const race = liveRace(store.db);
  if (!race) return { ok: false as const, reason: 'No race is running.' };
  const from = new Date(race.session_at);
  if (to.getTime() >= from.getTime()) return { ok: false as const, reason: 'The session can only move earlier.' };
  if (to.getTime() <= now().getTime()) return { ok: false as const, reason: 'Pick a time later than now, or START NOW.' };
  const t = store.tx();
  t.update('races', race.id, { session_at: to.toISOString() });
  t.log({
    race_id: race.id,
    page,
    kind: 'session-move',
    main: 'Moved the Mechanics session earlier',
    detail: `${fmtDayTime(from)} → ${fmtDayTime(to)}`,
  });
  const logId = t.commit();
  return { ok: true as const, logId };
}

/** BRIEF → START RACE N (at a time, or now). Ends the session. */
export function startNextRace(store: Store, startAt: Date) {
  const done = sessionRace(store.db);
  if (!done) return;
  const next = nextRaceAfter(store.db, done);
  if (!next) return;
  const t = store.tx();
  t.update('races', done.id, { status: 'done' });
  const nowD = now();
  const at = startAt.getTime() < nowD.getTime() ? nowD : startAt;
  t.update('races', next.id, {
    starts_at: at.toISOString(),
    session_at: sessionAfter(at, sessionSlot(t.db)).toISOString(),
    status: 'planned',
  });
  const brief = t.db.briefs.find((b) => b.race_id === next.id);
  if (brief) t.update('briefs', brief.id, { start_at: at.toISOString() });
  else t.insert('briefs', { race_id: next.id, focus: '', subgoal_focus: {}, start_at: at.toISOString() });
  t.commit();
  tick(store, nowD.getTime());
}

/** Runs on load and every second: starts races, starts sessions, auto-ends laps. */
export function tick(store: Store, nowMs: number) {
  const db = store.db;
  if (!profileOf(db)) return;

  // First race for a new account: starts now, ends at the next session slot.
  if (!db.races.length) {
    const t = store.tx();
    const start = new Date(nowMs);
    const race = t.insert('races', {
      number: 1,
      starts_at: start.toISOString(),
      session_at: sessionAfter(start, sessionSlot(db)).toISOString(),
      ended_at: null,
      status: 'live',
    });
    t.log({ race_id: race.id, page: 'week', kind: 'race-start', main: `${raceName(race)} started`, detail: 'your first race' });
    t.commit();
    return tick(store, nowMs);
  }

  // A live race whose session time has come: the session starts, the race ends at the session time.
  const live = liveRace(store.db);
  if (live && new Date(live.session_at).getTime() <= nowMs && !sessionRace(store.db)) {
    const t = store.tx();
    beginSession(t, live, new Date(live.session_at));
    t.commit();
  }

  // A planned race whose start has come (and no session is running).
  if (!liveRace(store.db) && !sessionRace(store.db)) {
    const next = upcomingRace(store.db);
    if (next && new Date(next.starts_at).getTime() <= nowMs) {
      const prev = racesSorted(store.db).filter((r) => r.number < next.number).at(-1);
      const t = store.tx();
      t.update('races', next.id, { status: 'live' });
      t.log({
        race_id: next.id,
        page: 'week',
        kind: 'race-start',
        main: `${raceName(next)} started`,
        detail: prev ? 'start time set in the Mechanics session' : '',
      });
      t.commit();
      if (new Date(next.session_at).getTime() <= nowMs) return tick(store, nowMs);
    }
  }

  // AUTO-END: stop once the planned length has been timed (pauses don't count).
  const run = runningTime(store.db);
  if (run) {
    const lap = store.get('laps', run.lap_id);
    if (lap && lap.auto_end) {
      const total = recordedMs(store.db, lap.id, nowMs);
      const planned = lap.planned_min * MIN;
      if (total >= planned) {
        const endAt = nowMs - (total - planned);
        const t = store.tx();
        t.update('lap_times', run.id, { ended_at: new Date(endAt).toISOString() });
        t.update('laps', lap.id, { status: 'done' });
        t.commit();
      }
    }
  }
}

/** For radio lines and the header. */
export function raceStatusText(store: Store): string {
  const db = store.db;
  const ses = sessionRace(db);
  if (ses) return 'MECHANICS SESSION';
  const r = driverRace(db);
  if (!r) return '';
  if (r.status === 'live') return 'ON TRACK';
  if (r.status === 'planned') return `STARTS ${fmtDayTime(r.starts_at)}`;
  return 'FINISHED';
}

export function lapsLeftAfter(store: Store, race: Race, at: Date): number {
  const ms = at.getTime();
  return lapsOf(store.db, race.id).filter(
    (l) => l.status === 'planned' && l.planned_start && new Date(l.planned_start).getTime() >= ms,
  ).length;
}
