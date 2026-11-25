import type { DB, Goal, Race } from '../../data/types';
import { goalDoneInRace, goalPlannedInRace, targetFor } from '../../domain/selectors';
import type { GridMode } from './WeekGrid';

/** Folded goals panel: each goal as a small pie of hours against its target. */
export function pieStyle(db: DB, race: Race, g: Goal, nowMs: number, mode: GridMode): React.CSSProperties {
  const target = Math.max(1, targetFor(db, race.id, g));
  const v = mode === 'session' ? goalPlannedInRace(db, race.id, g.id) : goalDoneInRace(db, race.id, g.id, nowMs);
  const pct = Math.min(100, (v / target) * 100);
  return {
    background: `conic-gradient(${g.color} ${pct}%, color-mix(in srgb, ${g.color} 22%, transparent) 0)`,
    boxShadow: `inset 0 0 0 1.5px ${g.color}`,
  };
}
