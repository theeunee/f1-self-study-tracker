// Repeating laps (brief §6 Race week): a rule makes a dotted copy on each matching day.
// + keeps that day's copy (it becomes a real lap), × skips it. Repeats are only created in the session.
import type { Store } from '../data/store';
import type { DB, Race, RepeatRule } from '../data/types';
import { addMinutes, atTime, dayKey, fmtWhen } from '../lib/time';
import { raceDays, raceEnd } from './selectors';

export interface Ghost {
  key: string;
  kind: 'repeat';
  rule: RepeatRule;
  date: string;
  start: Date;
  min: number;
  title: string;
  goal_id: string | null;
}

/** Dotted copies for a race that haven't been kept or skipped yet. */
export function repeatGhosts(db: DB, race: Race | undefined): Ghost[] {
  if (!race) return [];
  const out: Ghost[] = [];
  const end = raceEnd(race).getTime();
  const begin = new Date(race.starts_at).getTime();
  for (const rule of db.repeat_rules) {
    for (const day of raceDays(race)) {
      const key = dayKey(day);
      if (key < rule.from_date || (rule.until_date && key > rule.until_date)) continue;
      if (!rule.days.includes(day.getDay())) continue;
      if (db.repeat_choices.some((c) => c.rule_id === rule.id && c.date === key)) continue;
      const start = atTime(key, rule.start_time);
      // Only copies inside the race window (it may start late or end early).
      if (start.getTime() < begin - 24 * 3600_000 || start.getTime() >= end) continue;
      out.push({ key: `${rule.id}:${key}`, kind: 'repeat', rule, date: key, start, min: rule.length_min, title: rule.title, goal_id: rule.goal_id });
    }
  }
  return out;
}

export function keepGhost(store: Store, race: Race, g: Ghost, page: 'week' | 'home' = 'week') {
  const t = store.tx();
  const lap = t.insert('laps', {
    race_id: race.id,
    goal_id: g.goal_id,
    title: g.title,
    description: '',
    planned_start: g.start.toISOString(),
    planned_min: g.min,
    color: null,
    auto_end: true,
    status: 'planned',
    source: 'repeat',
    moved_from_lap_id: null,
    carried_from_lap_id: null,
  });
  t.insert('repeat_choices', { rule_id: g.rule.id, date: g.date, choice: 'kept', lap_id: lap.id });
  t.log({ race_id: race.id, page, kind: 'repeat-keep', main: `Kept ${g.title}`, detail: `repeat · ${fmtWhen(g.start)}` });
  return t.commit();
}

export function skipGhost(store: Store, race: Race, g: Ghost, page: 'week' | 'home' = 'week') {
  const t = store.tx();
  t.insert('repeat_choices', { rule_id: g.rule.id, date: g.date, choice: 'skipped', lap_id: null });
  t.log({ race_id: race.id, page, kind: 'repeat-skip', main: `Skipped ${g.title}`, detail: `repeat · ${fmtWhen(g.start)}` });
  return t.commit();
}

export function createRepeatRule(
  store: Store,
  race: Race,
  r: { title: string; goal_id: string | null; days: number[]; start_time: string; length_min: number },
) {
  const t = store.tx();
  const first = dayKey(raceDays(race)[0]);
  t.insert('repeat_rules', { ...r, from_date: first, until_date: null });
  t.log({ race_id: race.id, page: 'week', kind: 'repeat-add', main: `Added repeating lap ${r.title}`, detail: `${describeDays(r.days)} · ${r.start_time}–${endTime(r.start_time, r.length_min)}` });
  return t.commit();
}

export function endTime(start: string, min: number) {
  const d = addMinutes(atTime('2000-01-01', start), min);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function describeDays(days: number[]): string {
  const s = [...days].sort();
  const L = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  if (s.length === 7) return 'EVERY DAY';
  if (s.join() === '1,2,3,4,5') return 'WEEKDAYS';
  if (s.join() === '1,2,3,4,5,6') return 'MON–SAT';
  return s.map((d) => L[d]).join(' ');
}
