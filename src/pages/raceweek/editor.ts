// Editing laps on Race week.
// - Mechanics mode (mid-race): changes are a draft until SAVE; the log keeps the net change per lap
//   ("Moved Chapter 4 · Thu → Sat" even if it went Thu → Fri → Sat).
// - Mechanics session (planning the next race): changes apply straight away, each logged with undo.
import { useCallback, useMemo, useState } from 'react';
import { store } from '../../data/store';
import type { Lap, Race } from '../../data/types';
import { fmtDayTime, fmtDur, hhmm, addMinutes, uid, now } from '../../lib/time';

export type LapInput = Pick<Lap, 'title' | 'goal_id' | 'planned_start' | 'planned_min' | 'description'> & { color?: string | null };
export type LapPatch = Partial<Pick<Lap, 'title' | 'goal_id' | 'planned_start' | 'planned_min' | 'description' | 'color'>>;

export interface Editor {
  kind: 'draft' | 'live';
  laps: Lap[];
  add(input: LapInput): string | null;
  update(id: string, patch: LapPatch): string | null;
  remove(id: string): string | null;
  dirty: boolean;
  changes: Change[];
  save(): void;
  discard(): void;
}

export interface Change {
  id: string;
  main: string;
  detail: string;
  kind: string;
}

const where = (start: string | null, min: number) =>
  start ? `${fmtDayTime(start)}–${hhmm(addMinutes(start, min))}` : 'Laps to place';

/** Net change for one lap between the saved version and the draft. */
export function describeChange(before: Lap | undefined, after: Lap | undefined): Change | null {
  if (!before && after) return { id: after.id, kind: 'lap-add', main: `Added ${after.title}`, detail: where(after.planned_start, after.planned_min) };
  if (before && !after) return { id: before.id, kind: 'lap-delete', main: `Deleted ${before.title}`, detail: where(before.planned_start, before.planned_min) };
  if (!before || !after) return null;
  const moved = before.planned_start !== after.planned_start;
  const resized = before.planned_min !== after.planned_min;
  const renamed = before.title !== after.title;
  const other = before.description !== after.description || before.color !== after.color || before.goal_id !== after.goal_id;
  if (moved) {
    const from = before.planned_start ? fmtDayTime(before.planned_start) : 'Laps to place';
    const to = after.planned_start ? fmtDayTime(after.planned_start) : 'Laps to place';
    return {
      id: after.id,
      kind: 'lap-move',
      main: `${before.planned_start ? 'Moved' : 'Placed'} ${after.title}`,
      detail: `${from} → ${to}${resized ? ` · ${fmtDur(before.planned_min)} → ${fmtDur(after.planned_min)}` : ''}`,
    };
  }
  if (resized) return { id: after.id, kind: 'lap-resize', main: `Changed ${after.title}’s length`, detail: `${fmtDur(before.planned_min)} → ${fmtDur(after.planned_min)}` };
  if (renamed) return { id: after.id, kind: 'lap-edit', main: `Renamed ${before.title}`, detail: `→ ${after.title}` };
  if (other) return { id: after.id, kind: 'lap-edit', main: `Edited ${after.title}`, detail: '' };
  return null;
}

function newLap(race: Race, input: LapInput, id = uid()): Lap {
  const stamp = now().toISOString();
  return {
    id,
    user_id: store.userId,
    created_at: stamp,
    updated_at: stamp,
    race_id: race.id,
    goal_id: input.goal_id,
    title: input.title.trim(),
    description: input.description ?? '',
    planned_start: input.planned_start,
    planned_min: input.planned_min,
    color: input.color ?? null,
    auto_end: true,
    status: 'planned',
    source: 'manual',
    moved_from_lap_id: null,
    carried_from_lap_id: null,
  };
}

/** Draft editor for Mechanics mode. `base` is the race's laps as saved. */
export function useDraftEditor(race: Race | undefined, base: Lap[], active: boolean): Editor {
  const [draft, setDraft] = useState<Lap[] | null>(null);
  const laps = active && draft ? draft : base;
  const ensure = (fn: (d: Lap[]) => Lap[]) => setDraft((d) => fn(d ?? base));

  const changes = useMemo(() => {
    if (!draft) return [];
    const out: Change[] = [];
    const byId = new Map(draft.map((l) => [l.id, l]));
    for (const b of base) {
      const c = describeChange(b, byId.get(b.id));
      if (c) out.push(c);
    }
    for (const d of draft) if (!base.some((b) => b.id === d.id)) out.push(describeChange(undefined, d)!);
    return out;
  }, [draft, base]);

  const save = useCallback(() => {
    if (!draft || !race) return;
    const baseById = new Map(base.map((l) => [l.id, l]));
    const draftById = new Map(draft.map((l) => [l.id, l]));
    for (const c of changes) {
      const t = store.tx();
      const before = baseById.get(c.id);
      const after = draftById.get(c.id);
      if (!before && after) {
        const { id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = after;
        t.insert('laps', { ...rest, id });
      } else if (before && !after) t.remove('laps', before.id);
      else if (after) {
        t.update('laps', after.id, {
          title: after.title,
          description: after.description,
          planned_start: after.planned_start,
          planned_min: after.planned_min,
          color: after.color,
          goal_id: after.goal_id,
        });
      }
      t.log({ race_id: race.id, page: 'week', kind: c.kind, main: c.main, detail: c.detail });
      t.commit();
    }
    setDraft(null);
  }, [draft, base, changes, race]);

  return {
    kind: 'draft',
    laps,
    add(input) {
      if (!race) return null;
      const lap = newLap(race, input);
      ensure((d) => [...d, lap]);
      return null;
    },
    update(id, patch) {
      ensure((d) => d.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      return null;
    },
    remove(id) {
      ensure((d) => d.filter((l) => l.id !== id));
      return null;
    },
    dirty: changes.length > 0,
    changes,
    save,
    discard: () => setDraft(null),
  };
}

/** Live editor for planning the next race in the session: every change is saved and logged at once. */
export function liveEditor(race: Race | undefined, logRaceId: string | undefined, laps: Lap[]): Editor {
  const commit = (before: Lap | undefined, after: Lap | undefined, apply: (t: ReturnType<typeof store.tx>) => void) => {
    const c = describeChange(before, after);
    const t = store.tx();
    apply(t);
    if (c && logRaceId) t.log({ race_id: logRaceId, page: 'week', kind: c.kind, main: c.main, detail: c.detail });
    return t.commit();
  };
  return {
    kind: 'live',
    laps,
    add(input) {
      if (!race) return null;
      const lap = newLap(race, input);
      return commit(undefined, lap, (t) => {
        const { id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = lap;
        t.insert('laps', { ...rest, id });
      });
    },
    update(id, patch) {
      const before = laps.find((l) => l.id === id);
      if (!before) return null;
      return commit(before, { ...before, ...patch }, (t) => t.update('laps', id, patch));
    },
    remove(id) {
      const before = laps.find((l) => l.id === id);
      if (!before) return null;
      return commit(before, undefined, (t) => {
        // A carried lap dropped from the plan also clears its carry choice to "drop".
        const cc = t.db.carry_choices.find((c) => before.carried_from_lap_id && c.lap_id === before.carried_from_lap_id);
        if (cc) t.update('carry_choices', cc.id, { choice: 'drop' });
        t.remove('laps', id);
      });
    },
    dirty: false,
    changes: [],
    save() {},
    discard() {},
  };
}
