// Mechanics session · Race week opens on carry/drop (brief §6): every unfinished lap of the ending
// race gets CARRY or DROP. Carrying puts the lap into Laps to place straight away with only the time
// it had left; dropping a carried lap also takes it off the new plan. Not every lap needs a decision.
import { Link } from 'react-router-dom';
import { store, useDB } from '../data/store';
import type { DB, Lap, Race } from '../data/types';
import { goalOf, lapColor, lapIsDone, lapsOf, raceLabel, recordedMin } from '../domain/selectors';
import { useNowMs } from '../lib/hooks';
import { MIN, fmtDayTime, fmtDur, fmtWeekRange } from '../lib/time';
import { showToast } from '../ui/signals';
import { raceWeekStart } from '../domain/selectors';
import type { Store } from '../data/store';

export function unfinishedLaps(db: DB, ended: Race, nowMs: number): Lap[] {
  return lapsOf(db, ended.id)
    .filter((l) => l.status === 'planned' && !lapIsDone(db, l, nowMs))
    .sort((a, b) => (a.planned_start ?? '9').localeCompare(b.planned_start ?? '9'));
}

export function carryChoiceFor(db: DB, ended: Race, lapId: string) {
  return db.carry_choices.find((c) => c.race_id === ended.id && c.lap_id === lapId)?.choice ?? null;
}

function leftMin(db: DB, lap: Lap, nowMs: number) {
  return Math.max(5, Math.round((lap.planned_min * MIN - recordedMin(db, lap.id, nowMs) * MIN) / MIN / 5) * 5);
}

export function decide(store: Store, ended: Race, next: Race, lap: Lap, choice: 'carry' | 'drop', nowMs: number, log = true) {
  const t = store.tx();
  const existing = t.db.carry_choices.find((c) => c.race_id === ended.id && c.lap_id === lap.id);
  if (existing?.choice === choice) return null;
  if (existing) t.update('carry_choices', existing.id, { choice });
  else t.insert('carry_choices', { race_id: ended.id, lap_id: lap.id, choice });
  const carried = t.db.laps.find((l) => l.carried_from_lap_id === lap.id && l.race_id === next.id);
  if (choice === 'carry' && !carried) {
    t.insert('laps', {
      race_id: next.id,
      goal_id: lap.goal_id,
      title: lap.title,
      description: lap.description,
      planned_start: null,
      planned_min: leftMin(t.db, lap, nowMs),
      color: lap.color,
      auto_end: true,
      status: 'planned',
      source: 'carried',
      moved_from_lap_id: null,
      carried_from_lap_id: lap.id,
    });
  }
  if (choice === 'drop' && carried) t.remove('laps', carried.id);
  if (log) t.log({ race_id: ended.id, page: 'week', kind: `carry-${choice}`, main: `${choice === 'carry' ? 'Carried' : 'Dropped'} ${lap.title}`, detail: choice === 'carry' ? `${fmtDur(leftMin(t.db, lap, nowMs))} left · into Laps to place` : '' });
  return t.commit();
}

export function UnfinishedLaps({ ended, next, onClose }: { ended: Race; next: Race; onClose: () => void }) {
  const db = useDB();
  const nowMs = useNowMs(30000);
  const laps = unfinishedLaps(db, ended, nowMs);
  const decided = laps.filter((l) => carryChoiceFor(db, ended, l.id)).length;
  const all = (choice: 'carry' | 'drop') => {
    // One log entry for the batch, so a single undo puts it back.
    const t = store.tx();
    for (const l of laps) {
      const existing = t.db.carry_choices.find((c) => c.race_id === ended.id && c.lap_id === l.id);
      if (existing?.choice === choice) continue;
      if (existing) t.update('carry_choices', existing.id, { choice });
      else t.insert('carry_choices', { race_id: ended.id, lap_id: l.id, choice });
      const carried = t.db.laps.find((x) => x.carried_from_lap_id === l.id && x.race_id === next.id);
      if (choice === 'carry' && !carried)
        t.insert('laps', {
          race_id: next.id, goal_id: l.goal_id, title: l.title, description: l.description, planned_start: null,
          planned_min: leftMin(t.db, l, nowMs), color: l.color, auto_end: true, status: 'planned', source: 'carried',
          moved_from_lap_id: null, carried_from_lap_id: l.id,
        });
      if (choice === 'drop' && carried) t.remove('laps', carried.id);
    }
    t.log({ race_id: ended.id, page: 'week', kind: `carry-all`, main: choice === 'carry' ? 'Carried every unfinished lap' : 'Dropped every unfinished lap', detail: `${laps.length} laps` });
    const id = t.commit();
    if (id) showToast(choice === 'carry' ? 'Carried every unfinished lap' : 'Dropped every unfinished lap', id);
  };
  return (
    <section className="unf glass" aria-labelledby="unf-h">
      <div className="unf-head">
        <div>
          <span className="label label-red">START OF RACE WEEK · UNFINISHED LAPS</span>
          <h2 id="unf-h" className="display unf-title">
            {laps.length ? `${laps.length} LAP${laps.length === 1 ? '' : 'S'} NOT FINISHED` : 'EVERY LAP FINISHED'}
          </h2>
        </div>
        <span className="label">
          {decided} OF {laps.length} DECIDED
        </span>
        <div className="unf-all">
          <button className="btn btn-sm btn-outline" onClick={() => all('carry')} disabled={!laps.length}>
            CARRY ALL
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => all('drop')} disabled={!laps.length}>
            DROP ALL
          </button>
        </div>
      </div>
      <div className="unf-list">
        {!laps.length && <p className="muted">Every lap was finished. Nothing to carry over.</p>}
        {laps.map((l) => {
          const g = goalOf(db, l.goal_id);
          const choice = carryChoiceFor(db, ended, l.id);
          const rec = recordedMin(db, l.id, nowMs);
          return (
            <div key={l.id} className="unf-row">
              <span className="unf-bar" style={{ background: lapColor(db, l) }} />
              <span className="unf-main">
                <span className="unf-name">{l.title}</span>
                <span className="mono unf-meta">
                  {g?.name ?? 'No goal'} · {l.planned_start ? fmtDayTime(l.planned_start) : 'Laps to place'} ·{' '}
                  {rec > 0 ? `${fmtDur(rec)} of ${fmtDur(l.planned_min)} done` : `${fmtDur(l.planned_min)} planned`}
                </span>
              </span>
              <span className="mono unf-left">{fmtDur(leftMin(db, l, nowMs)).toUpperCase()} LEFT</span>
              <div role="radiogroup" aria-label={`${l.title}: carry or drop`} className="unf-choice">
                {(['carry', 'drop'] as const).map((c) => (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={choice === c}
                    className="chip mono-chip"
                    onClick={() => {
                      const id = decide(store, ended, next, l, c, nowMs);
                      if (id) showToast(`${c === 'carry' ? 'Carried' : 'Dropped'} ${l.title}`, id);
                    }}
                  >
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="unf-foot">
        <Link className="btn btn-outline" to="/">
          ← BACK TO THE DEBRIEF
        </Link>
        <span className="unf-note">Carried laps go straight into Laps to place, with only the time that’s left. Change your mind any time.</span>
        <button className="btn btn-red" onClick={onClose}>
          PLAN {raceLabel(next)} →
        </button>
      </div>
      <span className="sr-only">{fmtWeekRange(raceWeekStart(next))}</span>
    </section>
  );
}
