// Behaviour tests for the weekly loop (brief §5): session timing, auto-end, moving the session,
// undo rules, net-change logging, carry/drop, and starting the next race.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Store } from '../data/store';
import type { Adapter } from '../data/store';
import { emptyDB, type Lap } from '../data/types';
import { DEFAULT_BOARD, DEFAULT_PRESETS, liveRace, nextRaceAfter, recordedMs, runningTime, sessionRace } from './selectors';
import { moveSessionEarlier, startNextRace, tick } from './race';
import { moveToLater, startLap, pauseRunning, logTime } from './laps';
import { describeChange } from '../pages/raceweek/editor';
import { decide, unfinishedLaps } from '../session/Unfinished';
import { MIN } from '../lib/time';

const memory: Adapter = { kind: 'local', load: async () => emptyDB(), write: async () => {} };

async function freshStore(at: string) {
  vi.setSystemTime(new Date(at));
  const s = new Store();
  await s.init(memory, 'u1');
  const t = s.tx();
  t.insert('profiles', {
    id: 'u1', display_name: 'Driver', timezone: 'UTC', session_weekday: 6, session_time: '19:00',
    colour_board: DEFAULT_BOARD, length_presets: DEFAULT_PRESETS,
  });
  t.commit();
  return s;
}

function addLap(s: Store, raceId: string, title: string, start: string | null, min: number): Lap {
  const t = s.tx();
  const lap = t.insert('laps', {
    race_id: raceId, goal_id: null, title, description: '', planned_start: start ? new Date(start).toISOString() : null,
    planned_min: min, color: null, auto_end: true, status: 'planned', source: 'manual', moved_from_lap_id: null, carried_from_lap_id: null,
  });
  t.commit();
  return lap;
}

const at = (iso: string) => new Date(iso).getTime();

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('race lifecycle', () => {
  it('a new account gets Race 01 that ends at the next Saturday 19:00', async () => {
    const s = await freshStore('2026-11-24T10:00:00'); // Tue
    tick(s, Date.now());
    const r = liveRace(s.db)!;
    expect(r.number).toBe(1);
    expect(new Date(r.session_at).toString()).toContain('Sat Nov 28 2026 19:00');
    expect(s.db.log_entries.map((e) => e.main)).toEqual(['Race 01 started']);
  });

  it('the session starts at its time even if the app was closed; the running lap stops at the session time', async () => {
    const s = await freshStore('2026-11-28T18:30:00');
    tick(s, Date.now());
    const race = liveRace(s.db)!;
    const lap = addLap(s, race.id, 'Late lap', '2026-11-28T18:30:00', 120);
    lap.auto_end = false;
    startLap(s, lap);
    // Reopen the app on Sunday morning.
    vi.setSystemTime(new Date('2026-11-29T08:00:00'));
    tick(s, Date.now());
    const ses = sessionRace(s.db)!;
    expect(ses.id).toBe(race.id);
    expect(new Date(ses.ended_at!).getTime()).toBe(at('2026-11-28T19:00:00'));
    expect(runningTime(s.db)).toBeUndefined();
    expect(recordedMs(s.db, lap.id, Date.now())).toBe(30 * MIN); // 18:30 → 19:00, time kept
    expect(nextRaceAfter(s.db, ses)!.status).toBe('planned');
  });

  it('starting the next race early keeps the planned week’s session (races stretch)', async () => {
    const s = await freshStore('2026-11-25T10:00:00'); // Wed
    tick(s, Date.now());
    const race = liveRace(s.db)!;
    // Emergency pit stop: start the session now.
    const t = s.tx();
    t.update('races', race.id, { session_at: new Date().toISOString() });
    t.commit();
    tick(s, Date.now());
    const next = nextRaceAfter(s.db, sessionRace(s.db)!)!;
    const plannedSession = next.session_at;
    startNextRace(s, new Date()); // START NOW on Wednesday
    const live = liveRace(s.db)!;
    expect(live.id).toBe(next.id);
    expect(live.session_at).toBe(plannedSession);
    expect(s.db.races.find((r) => r.id === race.id)!.status).toBe('done');
  });
});

describe('timer', () => {
  it('AUTO-END stops the lap exactly at its planned length, pauses not counted', async () => {
    const s = await freshStore('2026-11-24T10:00:00');
    tick(s, Date.now());
    const lap = addLap(s, liveRace(s.db)!.id, 'Drills', '2026-11-24T10:00:00', 30);
    startLap(s, lap);
    vi.setSystemTime(new Date('2026-11-24T10:10:00'));
    pauseRunning(s);
    vi.setSystemTime(new Date('2026-11-24T10:20:00'));
    startLap(s, s.get('laps', lap.id)!);
    vi.setSystemTime(new Date('2026-11-24T11:00:00')); // app was away; should end at 10:40
    tick(s, Date.now());
    expect(runningTime(s.db)).toBeUndefined();
    expect(recordedMs(s.db, lap.id, Date.now())).toBe(30 * MIN);
    expect(s.get('laps', lap.id)!.status).toBe('done');
  });
});

describe('moving', () => {
  it('the session only moves earlier, and the move can be undone today', async () => {
    const s = await freshStore('2026-11-24T10:00:00');
    tick(s, Date.now());
    expect(moveSessionEarlier(s, new Date('2026-11-29T10:00:00'), 'home').ok).toBe(false);
    const r = moveSessionEarlier(s, new Date('2026-11-27T18:00:00'), 'home');
    expect(r.ok).toBe(true);
    expect(s.undo((r as { logId: string }).logId).ok).toBe(true);
    expect(new Date(liveRace(s.db)!.session_at).getTime()).toBe(at('2026-11-28T19:00:00'));
    expect(s.db.log_entries.find((e) => e.kind === 'session-move')!.undone).toBe(true);
  });

  it('MOVE TO LATER keeps the old lap as moved and copies only the time left', async () => {
    const s = await freshStore('2026-11-24T10:00:00');
    tick(s, Date.now());
    const lap = addLap(s, liveRace(s.db)!.id, 'Chapter 4', '2026-11-24T10:00:00', 60);
    startLap(s, lap);
    vi.setSystemTime(new Date('2026-11-24T10:20:00'));
    moveToLater(s, s.get('laps', lap.id)!, new Date('2026-11-26T18:00:00'));
    expect(s.get('laps', lap.id)!.status).toBe('moved');
    const copy = s.db.laps.find((l) => l.moved_from_lap_id === lap.id)!;
    expect(copy.planned_min).toBe(40);
    expect(runningTime(s.db)).toBeUndefined();
    expect(recordedMs(s.db, lap.id, Date.now())).toBe(20 * MIN);
  });
});

describe('undo', () => {
  it('only today’s entries can be undone', async () => {
    const s = await freshStore('2026-11-24T10:00:00');
    tick(s, Date.now());
    const lap = addLap(s, liveRace(s.db)!.id, 'Kanji', '2026-11-24T08:00:00', 30);
    const id = logTime(s, lap, new Date('2026-11-24T08:00:00'), new Date('2026-11-24T08:30:00'), true, 'home')!;
    vi.setSystemTime(new Date('2026-11-25T09:00:00'));
    expect(s.undo(id)).toEqual({ ok: false, reason: 'Only today’s changes can be undone.' });
  });

  it('refuses when the same row changed again after the entry', async () => {
    const s = await freshStore('2026-11-24T10:00:00');
    tick(s, Date.now());
    const lap = addLap(s, liveRace(s.db)!.id, 'Kanji', '2026-11-24T11:00:00', 30);
    const first = moveToLater(s, lap, new Date('2026-11-25T11:00:00'))!;
    const copy = s.db.laps.find((l) => l.moved_from_lap_id === lap.id)!;
    moveToLater(s, copy, new Date('2026-11-26T11:00:00'));
    expect(s.undo(first).ok).toBe(false);
  });
});

describe('Mechanics mode net change', () => {
  it('logs Thu → Sat, not each step', () => {
    const base = { id: 'l1', title: 'Chapter 4', planned_start: new Date('2026-11-26T18:00:00').toISOString(), planned_min: 30 } as Lap;
    const after = { ...base, planned_start: new Date('2026-11-28T10:00:00').toISOString() };
    const c = describeChange(base, after)!;
    expect(c.main).toBe('Moved Chapter 4');
    expect(c.detail).toBe('Thu 26 18:00 → Sat 28 10:00');
    expect(describeChange(base, { ...base })).toBeNull();
  });
});

describe('carry / drop', () => {
  it('carry puts the time left into Laps to place; dropping removes the carried copy', async () => {
    const s = await freshStore('2026-11-28T18:00:00');
    tick(s, Date.now());
    const race = liveRace(s.db)!;
    const lap = addLap(s, race.id, 'Parse dates', '2026-11-28T17:00:00', 60);
    logTime(s, lap, new Date('2026-11-28T17:00:00'), new Date('2026-11-28T17:15:00'), false, 'home');
    vi.setSystemTime(new Date('2026-11-28T19:05:00'));
    tick(s, Date.now());
    const ses = sessionRace(s.db)!;
    const next = nextRaceAfter(s.db, ses)!;
    expect(unfinishedLaps(s.db, ses, Date.now()).map((l) => l.title)).toEqual(['Parse dates']);
    decide(s, ses, next, lap, 'carry', Date.now());
    const carried = s.db.laps.find((l) => l.carried_from_lap_id === lap.id)!;
    expect(carried.race_id).toBe(next.id);
    expect(carried.planned_start).toBeNull();
    expect(carried.planned_min).toBe(45);
    decide(s, ses, next, lap, 'drop', Date.now());
    expect(s.db.laps.some((l) => l.carried_from_lap_id === lap.id)).toBe(false);
  });
});
