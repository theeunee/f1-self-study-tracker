// Driver actions on laps (brief §5, §6 Home). Starting/pausing is not logged (as in the designs);
// logged time, moves, hand records and calendar adds/dismissals are.
import type { Store } from '../data/store';
import type { Lap, LapTime, LogPage } from '../data/types';
import { MIN, fmtDayTime, fmtDur, hhmm, now } from '../lib/time';
import { stopRunning } from './race';
import { recordedMs, runningTime } from './selectors';

export function startLap(store: Store, lap: Lap) {
  const t = store.tx();
  const at = now();
  const run = runningTime(t.db);
  if (run && run.lap_id === lap.id) return;
  stopRunning(t, at);
  // Starting a lap that already reached its planned length with AUTO-END on would stop at once:
  // carry on past it instead (same as KEEP GOING).
  const reached = recordedMs(t.db, lap.id, at.getTime()) >= lap.planned_min * MIN;
  if (lap.auto_end && reached) t.update('laps', lap.id, { auto_end: false });
  if (lap.status === 'done' && reached) t.update('laps', lap.id, { status: 'planned' });
  t.insert('lap_times', { lap_id: lap.id, started_at: at.toISOString(), ended_at: null, how: 'timed' });
  t.commit();
}

export function pauseRunning(store: Store) {
  const t = store.tx();
  stopRunning(t, now());
  t.commit();
}

export function setAutoEnd(store: Store, lap: Lap, on: boolean) {
  const t = store.tx();
  t.update('laps', lap.id, { auto_end: on });
  t.commit();
}

/** After AUTO-END stopped a lap: untick auto-end and carry on recording. */
export function keepGoing(store: Store, lap: Lap) {
  const t = store.tx();
  const at = now();
  stopRunning(t, at);
  t.update('laps', lap.id, { auto_end: false, status: 'planned' });
  t.insert('lap_times', { lap_id: lap.id, started_at: at.toISOString(), ended_at: null, how: 'timed' });
  t.commit();
}

export function finishLap(store: Store, lap: Lap) {
  const t = store.tx();
  const run = runningTime(t.db);
  if (run?.lap_id === lap.id) stopRunning(t, now());
  t.update('laps', lap.id, { status: 'done' });
  t.commit();
}

function range(start: Date, end: Date) {
  return `${hhmm(start)}–${hhmm(end)}`;
}

/** LOG TIME: record time done away from the screen. */
export function logTime(
  store: Store,
  lap: Lap,
  start: Date,
  end: Date,
  complete: boolean,
  page: LogPage,
): string | null {
  const t = store.tx();
  t.insert('lap_times', { lap_id: lap.id, started_at: start.toISOString(), ended_at: end.toISOString(), how: 'by_hand' });
  if (complete && lap.status !== 'done') t.update('laps', lap.id, { status: 'done' });
  t.log({
    race_id: lap.race_id,
    page,
    kind: 'log-time',
    main: `Logged ${lap.title}`,
    detail: `${fmtDur((end.getTime() - start.getTime()) / MIN)} by hand, ${range(start, end)}${complete ? ' · marked complete' : ''}`,
  });
  return t.commit();
}

export function editTime(store: Store, lap: Lap, time: LapTime, start: Date, end: Date, complete: boolean): string | null {
  const t = store.tx();
  t.update('lap_times', time.id, { started_at: start.toISOString(), ended_at: end.toISOString() });
  if (complete !== (lap.status === 'done')) t.update('laps', lap.id, { status: complete ? 'done' : 'planned' });
  t.log({
    race_id: lap.race_id,
    page: 'home',
    kind: 'edit-time',
    main: `Edited a time on ${lap.title}`,
    detail: `${range(new Date(time.started_at), new Date(time.ended_at ?? time.started_at))} → ${range(start, end)}`,
  });
  return t.commit();
}

export function removeTime(store: Store, lap: Lap, time: LapTime): string | null {
  const t = store.tx();
  t.remove('lap_times', time.id);
  const left = recordedMs(t.db, lap.id, now().getTime());
  if (lap.status === 'done' && left < lap.planned_min * MIN) t.update('laps', lap.id, { status: 'planned' });
  const start = new Date(time.started_at);
  const end = new Date(time.ended_at ?? time.started_at);
  t.log({
    race_id: lap.race_id,
    page: 'home',
    kind: 'remove-time',
    main: `Removed a time from ${lap.title}`,
    detail: `${fmtDur((end.getTime() - start.getTime()) / MIN)}, ${range(start, end)}`,
  });
  return t.commit();
}

/**
 * MOVE TO LATER: the lap stays on its old day marked as moved; a copy with the time it had left
 * goes to the new slot. If it was running, the timer stops and its time is kept.
 */
export function moveToLater(store: Store, lap: Lap, to: Date): string | null {
  const t = store.tx();
  const at = now();
  if (runningTime(t.db)?.lap_id === lap.id) stopRunning(t, at);
  const left = Math.max(15, Math.round(lap.planned_min - recordedMs(t.db, lap.id, at.getTime()) / MIN));
  t.update('laps', lap.id, { status: 'moved' });
  t.insert('laps', {
    race_id: lap.race_id,
    goal_id: lap.goal_id,
    title: lap.title,
    description: lap.description,
    planned_start: to.toISOString(),
    planned_min: left,
    color: lap.color,
    auto_end: lap.auto_end,
    status: 'planned',
    source: lap.source,
    moved_from_lap_id: lap.id,
    carried_from_lap_id: lap.carried_from_lap_id,
  });
  t.log({
    race_id: lap.race_id,
    page: 'home',
    kind: 'move',
    main: `Moved ${lap.title}`,
    detail: `${lap.planned_start ? fmtDayTime(lap.planned_start) : 'Laps to place'} → ${fmtDayTime(to)}`,
  });
  return t.commit();
}
