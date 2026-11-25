// Pure read-side helpers: given the DB and a moment, answer questions about races, laps and goals.
import { DAY, MIN, addDays, atTime, dayKey, startOfWeek, toDate } from '../lib/time';
import type { DB, Goal, Lap, LapTime, Profile, Race } from '../data/types';

export const NO_GOAL_COLOR = '#8F8F97';
export const DEFAULT_BOARD = ['#E10600', '#111111', '#7A3CE0', '#00A86B', '#F5B700', '#1C64F2', '#0E9FA6', '#E6007E'];
export const DEFAULT_PRESETS = [30, 60, 90, 120];

export function profileOf(db: DB): Profile | undefined {
  return db.profiles[0];
}

export function sessionSlot(db: DB): { weekday: number; time: string } {
  const p = profileOf(db);
  return { weekday: p?.session_weekday ?? 6, time: p?.session_time ?? '19:00' };
}

/** The scheduled session for a race that starts at `startsAt`: the first session slot after it. */
export function sessionAfter(startsAt: Date, slot: { weekday: number; time: string }): Date {
  const week = startOfWeek(startsAt);
  let at = atTime(addDays(week, slot.weekday), slot.time);
  if (at.getTime() <= startsAt.getTime()) at = atTime(addDays(week, slot.weekday + 7), slot.time);
  return at;
}

export function racesSorted(db: DB): Race[] {
  return [...db.races].sort((a, b) => a.number - b.number);
}

/** The race being driven, or in its session. */
export function liveRace(db: DB): Race | undefined {
  return db.races.find((r) => r.status === 'live');
}
export function sessionRace(db: DB): Race | undefined {
  return db.races.find((r) => r.status === 'in_session');
}
/** The race that comes after `race` (planned during its session). */
export function nextRaceAfter(db: DB, race: Race): Race | undefined {
  return db.races.find((r) => r.number === race.number + 1);
}
export function upcomingRace(db: DB): Race | undefined {
  return racesSorted(db).find((r) => r.status === 'planned');
}

/** What Driver pages show: the live race, else the planned one that starts next, else the latest. */
export function driverRace(db: DB): Race | undefined {
  return liveRace(db) ?? sessionRace(db) ?? upcomingRace(db) ?? racesSorted(db).at(-1);
}

export function inSession(db: DB): boolean {
  return !!sessionRace(db);
}

export function raceLabel(r: Race | undefined): string {
  return r ? `RACE ${String(r.number).padStart(2, '0')}` : 'RACE';
}
export function raceName(r: Race | undefined): string {
  return r ? `Race ${String(r.number).padStart(2, '0')}` : 'Race';
}

/** Sunday of the race's week (the week its session falls in). */
export function raceWeekStart(r: Race): Date {
  return startOfWeek(new Date(new Date(r.session_at).getTime() - 1));
}
export function raceDays(r: Race): Date[] {
  const s = raceWeekStart(r);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}
/** When the race actually ends: its end if it has ended, else its scheduled session. */
export function raceEnd(r: Race): Date {
  return new Date(r.ended_at ?? r.session_at);
}

// ───────────────────────── laps & times

export function lapsOf(db: DB, raceId: string | undefined): Lap[] {
  if (!raceId) return [];
  return db.laps.filter((l) => l.race_id === raceId);
}

/** Laps that count toward the plan (not moved away, not dropped). */
export function countedLaps(db: DB, raceId: string | undefined): Lap[] {
  return lapsOf(db, raceId).filter((l) => l.status !== 'moved' && l.status !== 'dropped');
}

export function timesOf(db: DB, lapId: string): LapTime[] {
  return db.lap_times.filter((t) => t.lap_id === lapId).sort((a, b) => a.started_at.localeCompare(b.started_at));
}

export function runningTime(db: DB): LapTime | undefined {
  return db.lap_times.find((t) => !t.ended_at);
}

export function timeMs(t: LapTime, nowMs: number): number {
  const end = t.ended_at ? new Date(t.ended_at).getTime() : nowMs;
  return Math.max(0, end - new Date(t.started_at).getTime());
}

export function recordedMs(db: DB, lapId: string, nowMs: number): number {
  let sum = 0;
  for (const t of db.lap_times) if (t.lap_id === lapId) sum += timeMs(t, nowMs);
  return sum;
}
export function recordedMin(db: DB, lapId: string, nowMs: number): number {
  return recordedMs(db, lapId, nowMs) / MIN;
}

export function lapIsDone(db: DB, lap: Lap, nowMs: number): boolean {
  if (lap.status === 'done') return true;
  if (lap.status !== 'planned') return false;
  const running = runningTime(db);
  return (!running || running.lap_id !== lap.id) && recordedMs(db, lap.id, nowMs) >= lap.planned_min * MIN;
}

export function lapIsRunning(db: DB, lap: Lap): boolean {
  return runningTime(db)?.lap_id === lap.id;
}

/** Where a lap sits: where it actually happened (its first recorded time), else where it was planned. */
export function lapPlacedStart(db: DB, lap: Lap): Date | null {
  const times = timesOf(db, lap.id);
  if (times.length) return new Date(times[0].started_at);
  return lap.planned_start ? new Date(lap.planned_start) : null;
}

/** Height on the grid, in minutes. Overtime grows the block. */
export function lapPlacedMin(db: DB, lap: Lap, nowMs: number): number {
  const rec = recordedMin(db, lap.id, nowMs);
  if (lap.status === 'done' && rec > 0) return Math.max(15, rec);
  return Math.max(lap.planned_min, rec);
}

export function lapDayKey(db: DB, lap: Lap): string | null {
  const s = lapPlacedStart(db, lap);
  return s ? dayKey(s) : null;
}

/** Laps left to run = counted, not done, with time still to give. */
export function lapRemainingMin(db: DB, lap: Lap, nowMs: number): number {
  return Math.max(0, lap.planned_min - recordedMin(db, lap.id, nowMs));
}

// ───────────────────────── goals

export function liveGoals(db: DB): Goal[] {
  return db.goals.filter((g) => !g.deleted_at).sort((a, b) => a.sort_order - b.sort_order);
}
export function activeGoals(db: DB): Goal[] {
  return liveGoals(db).filter((g) => g.status === 'active');
}
export function goalOf(db: DB, id: string | null | undefined): Goal | undefined {
  if (!id) return undefined;
  const g = db.goals.find((x) => x.id === id);
  return g && !g.deleted_at ? g : undefined;
}

export function lapColor(db: DB, lap: Lap): string {
  return lap.color ?? goalOf(db, lap.goal_id)?.color ?? NO_GOAL_COLOR;
}

/** Weekly target for a race: the one-race override if set, else the goal's weekly target. */
export function targetFor(db: DB, raceId: string | undefined, goal: Goal): number {
  const o = raceId ? db.race_targets.find((t) => t.race_id === raceId && t.goal_id === goal.id) : undefined;
  return o ? o.target_min : goal.weekly_target_min;
}

export function goalDoneInRace(db: DB, raceId: string | undefined, goalId: string | null, nowMs: number): number {
  let sum = 0;
  for (const l of lapsOf(db, raceId)) if ((l.goal_id ?? null) === goalId) sum += recordedMin(db, l.id, nowMs);
  return sum;
}

export function goalPlannedInRace(db: DB, raceId: string | undefined, goalId: string | null): number {
  let sum = 0;
  for (const l of countedLaps(db, raceId)) if ((l.goal_id ?? null) === goalId) sum += l.planned_min;
  return sum;
}

export function goalTotalMin(db: DB, goalId: string, nowMs: number): number {
  let sum = 0;
  const laps = new Set(db.laps.filter((l) => l.goal_id === goalId).map((l) => l.id));
  for (const t of db.lap_times) if (laps.has(t.lap_id)) sum += timeMs(t, nowMs);
  return sum / MIN;
}

export function goalFirstLogged(db: DB, goalId: string): string | null {
  const laps = new Set(db.laps.filter((l) => l.goal_id === goalId).map((l) => l.id));
  let first: string | null = null;
  for (const t of db.lap_times) if (laps.has(t.lap_id) && (!first || t.started_at < first)) first = t.started_at;
  return first;
}

/** Races left until a goal's deadline, counting the current one. */
export function racesLeft(dueDate: string, ref: Date): number {
  const end = new Date(`${dueDate}T23:59:59`);
  const weeks = Math.ceil((end.getTime() - startOfWeek(ref).getTime()) / (7 * DAY));
  return Math.max(0, weeks);
}

export function smartScore(g: Goal): number {
  return [g.smart_s, g.smart_m, g.smart_a, g.smart_r].filter((s) => s.trim()).length + (g.due_date ? 1 : 0);
}

/** Total weekly target across active goals. */
export function totalWeeklyTarget(db: DB): number {
  return activeGoals(db).reduce((s, g) => s + g.weekly_target_min, 0);
}

export function dateOnly(d: string | Date): string {
  return dayKey(toDate(d));
}
