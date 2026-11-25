// Goal actions. Structure edits happen only in the Mechanics session (the page checks canEdit);
// colour and order can change any time (brief §5 Goals).
import type { Store } from '../data/store';
import type { Goal, Subgoal } from '../data/types';
import { dayKey, fmtDateShort, fromDayKey, now, DAY } from '../lib/time';
import { driverRace, liveGoals, sessionRace } from './selectors';

export type GoalFields = Pick<
  Goal,
  'name' | 'color' | 'smart_s' | 'smart_m' | 'smart_a' | 'smart_r' | 'start_date' | 'due_date' | 'weekly_target_min'
>;

function raceId(store: Store): string {
  return (sessionRace(store.db) ?? driverRace(store.db))?.id ?? '';
}

function logAndCommit(store: Store, t: ReturnType<Store['tx']>, main: string, detail = '', kind = 'goal') {
  const rid = raceId(store);
  if (rid) t.log({ race_id: rid, page: 'goals', kind, main, detail });
  return t.commit();
}

export function validateGoal(f: GoalFields, mode: 'new' | 'edit'): string | null {
  if (!f.name.trim()) return 'Give the goal a short name. It shows on your laps.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.due_date)) return 'Pick a date for T. A goal needs a finish line.';
  if (f.due_date <= f.start_date) return 'The deadline has to be after the start date.';
  if (mode === 'new' && f.due_date <= dayKey(now())) return 'The deadline has to be after today.';
  if (!f.weekly_target_min || f.weekly_target_min < 15) return 'Set a weekly target, like 2h or 1h 30m.';
  return null;
}

export function createGoal(store: Store, f: GoalFields): { id: string; logId: string | null } {
  const t = store.tx();
  const maxOrder = Math.max(-1, ...liveGoals(t.db).map((g) => g.sort_order));
  const g = t.insert('goals', {
    ...f,
    name: f.name.trim(),
    status: 'active',
    sort_order: maxOrder + 1,
    achieved_on: null,
    archived_on: null,
    deleted_at: null,
  });
  return { id: g.id, logId: logAndCommit(store, t, `Added goal “${g.name}”`) };
}

export function daysBetween(a: string, b: string) {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / DAY);
}

/** Saves an edit. Moving the deadline later leaves a mark in the goal's history. */
export function updateGoal(store: Store, goal: Goal, f: Partial<GoalFields>, msg?: string): string | null {
  const t = store.tx();
  t.update('goals', goal.id, f);
  if (f.due_date && f.due_date > goal.due_date) {
    t.insert('goal_marks', { goal_id: goal.id, kind: 'deadline_moved', from_date: goal.due_date, to_date: f.due_date, made_on: dayKey(now()) });
  }
  return logAndCommit(store, t, msg ?? `Saved “${f.name ?? goal.name}”`, f.due_date && f.due_date !== goal.due_date ? `due ${fmtDateShort(goal.due_date)} → ${fmtDateShort(f.due_date)}` : '');
}

export function setGoalColor(store: Store, goal: Goal, color: string) {
  const t = store.tx();
  t.update('goals', goal.id, { color });
  t.commit();
}

export function setWeeklyTarget(store: Store, goal: Goal, min: number) {
  const t = store.tx();
  t.update('goals', goal.id, { weekly_target_min: Math.max(15, Math.min(6000, Math.round(min))) });
  return logAndCommit(store, t, `Set ${goal.name}’s weekly target`, `${goal.weekly_target_min}m → ${min}m`);
}

export function setAchieved(store: Store, goal: Goal, achieved: boolean) {
  const t = store.tx();
  t.update('goals', goal.id, achieved ? { status: 'achieved', achieved_on: dayKey(now()) } : { status: 'active', achieved_on: null });
  return logAndCommit(store, t, achieved ? `Marked “${goal.name}” achieved` : `Reopened “${goal.name}”`);
}

export function setArchived(store: Store, goal: Goal, archived: boolean) {
  const t = store.tx();
  t.update(
    'goals',
    goal.id,
    archived
      ? { status: 'archived', archived_on: dayKey(now()) }
      : { status: goal.achieved_on ? 'achieved' : 'active', archived_on: null },
  );
  return logAndCommit(store, t, archived ? `Archived “${goal.name}”` : `Unarchived “${goal.name}”`);
}

/** Delete: soft-deletes the goal; its laps keep their recorded time but count toward no goal. */
export function deleteGoal(store: Store, goal: Goal) {
  const t = store.tx();
  t.update('goals', goal.id, { deleted_at: now().toISOString() });
  for (const l of t.db.laps.filter((x) => x.goal_id === goal.id)) t.update('laps', l.id, { goal_id: null });
  for (const r of t.db.repeat_rules.filter((x) => x.goal_id === goal.id)) t.update('repeat_rules', r.id, { goal_id: null });
  return logAndCommit(store, t, `Deleted goal “${goal.name}”`);
}

export function reorderGoals(store: Store, orderedIds: string[]) {
  const t = store.tx();
  orderedIds.forEach((id, i) => {
    const g = t.get('goals', id);
    if (g && g.sort_order !== i) t.update('goals', id, { sort_order: i });
  });
  t.commit();
}

export function addSubgoal(store: Store, goal: Goal, title: string, start: string, due: string) {
  const t = store.tx();
  t.insert('subgoals', { goal_id: goal.id, title: title.trim(), start_date: start, due_date: due, done: false });
  return logAndCommit(store, t, `Added subgoal “${title.trim()}”`, goal.name);
}

export function updateSubgoal(store: Store, sub: Subgoal, patch: Partial<Subgoal>, msg?: string) {
  const t = store.tx();
  t.update('subgoals', sub.id, patch);
  return logAndCommit(
    store,
    t,
    msg ?? `Edited subgoal “${patch.title ?? sub.title}”`,
    patch.start_date || patch.due_date
      ? `${fmtDateShort(patch.start_date ?? sub.start_date)} → ${fmtDateShort(patch.due_date ?? sub.due_date)}`
      : '',
  );
}

export function toggleSubgoal(store: Store, sub: Subgoal) {
  const t = store.tx();
  t.update('subgoals', sub.id, { done: !sub.done });
  return logAndCommit(store, t, sub.done ? `Reopened subgoal “${sub.title}”` : `Ticked “${sub.title}”`);
}

export function removeSubgoal(store: Store, sub: Subgoal) {
  const t = store.tx();
  t.remove('subgoals', sub.id);
  return logAndCommit(store, t, `Removed subgoal “${sub.title}”`);
}

/** Colour board (brief §6): eight defaults plus custom colours, kept on the profile. */
export function addBoardColor(store: Store, hex: string) {
  const p = store.db.profiles[0];
  if (!p) return;
  const up = hex.toUpperCase();
  if (p.colour_board.map((c) => c.toUpperCase()).includes(up)) return;
  const t = store.tx();
  t.update('profiles', p.id, { colour_board: [...p.colour_board, up] });
  t.commit();
}

export function removeBoardColor(store: Store, hex: string) {
  const p = store.db.profiles[0];
  if (!p) return;
  const t = store.tx();
  t.update('profiles', p.id, { colour_board: p.colour_board.filter((c) => c.toUpperCase() !== hex.toUpperCase()) });
  t.commit();
}
