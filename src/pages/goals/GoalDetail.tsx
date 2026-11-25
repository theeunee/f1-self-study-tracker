import { useState } from 'react';
import { store, useDB } from '../../data/store';
import type { Goal, Subgoal } from '../../data/types';
import { addSubgoal, removeSubgoal, setAchieved, setArchived, setWeeklyTarget, toggleSubgoal } from '../../domain/goals';
import {
  driverRace,
  goalDoneInRace,
  goalFirstLogged,
  goalTotalMin,
  racesLeft,
  sessionRace,
  smartScore,
  targetFor,
} from '../../domain/selectors';
import { useNowMs } from '../../lib/hooks';
import { dayKey, daysUntil, fmtDateLong, fmtDateShort, fmtDur, now } from '../../lib/time';
import { TargetStepper } from '../../ui/TargetStepper';
import { IconPlus, IconX } from '../../ui/icons';
import { showToast } from '../../ui/signals';

export const SMART_LABELS: [keyof Goal, string, string][] = [
  ['smart_s', 'S', 'SPECIFIC'],
  ['smart_m', 'M', 'MEASURABLE'],
  ['smart_a', 'A', 'ACHIEVABLE'],
  ['smart_r', 'R', 'RELEVANT'],
];

export function GoalDetail({
  goal,
  canEdit,
  onClose,
  onColour,
  onEdit,
  onHistory,
  onDelete,
  onEditSub,
}: {
  goal: Goal;
  canEdit: boolean;
  onClose: () => void;
  onColour: (el: HTMLElement) => void;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onEditSub: (s: Subgoal) => void;
}) {
  const db = useDB();
  const nowMs = useNowMs(15000);
  const active = goal.status === 'active';
  const achieved = goal.status === 'achieved';
  const archived = goal.status === 'archived';
  const race = sessionRace(db) ?? driverRace(db);
  const did = goalDoneInRace(db, race?.id, goal.id, nowMs);
  const target = targetFor(db, race?.id, goal);
  const total = goalTotalMin(db, goal.id, nowMs);
  const first = goalFirstLogged(db, goal.id);
  const subs = db.subgoals.filter((s) => s.goal_id === goal.id).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const dd = daysUntil(goal.due_date);
  const [subTitle, setSubTitle] = useState('');
  const [subStart, setSubStart] = useState(dayKey(now()));
  const [subDue, setSubDue] = useState(goal.due_date);
  const addSub = () => {
    if (!subTitle.trim()) return;
    if (subDue <= subStart) return showToast('The end date has to be after the start.');
    const id = addSubgoal(store, goal, subTitle, subStart, subDue);
    showToast(`Added “${subTitle.trim()}”`, id);
    setSubTitle('');
  };
  const chip = achieved ? 'ACHIEVED' : archived ? 'ARCHIVED' : 'ACTIVE';

  return (
    <aside id="goal-detail" className="goal-detail glass" aria-label="Goal details">
      <div className="gd-head">
        <button className="tl-colour" aria-label={`${goal.name} colour. Change colour`} title="Change colour" onClick={(e) => onColour(e.currentTarget)}>
          <span className="dot goal-dot big" style={{ background: goal.color }} />
        </button>
        <h2 className="gd-name">{goal.name}</h2>
        <span className={`gd-chip mono ${chip.toLowerCase()}`}>{chip}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close goal details">
          <IconX />
        </button>
      </div>
      {goal.smart_s && <p className="gd-statement">{goal.smart_s}</p>}

      {active && (
        <div className="gd-dday">
          <span className="display gd-dday-num">{dd >= 0 ? `D-${dd}` : `D+${-dd}`}</span>
          <span className="gd-dday-meta mono">
            <span>DUE {fmtDateLong(goal.due_date)}</span>
            <span className="red-text">{racesLeft(goal.due_date, now())} RACES LEFT</span>
          </span>
        </div>
      )}

      <div className="gd-stats">
        {active && (
          <div className="gd-stat">
            <span className="label">THIS RACE</span>
            <span className="gd-stat-val">
              {fmtDur(did)} / {fmtDur(target)}
            </span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.min(100, (did / Math.max(1, target)) * 100)}%`, background: goal.color }} />
            </div>
          </div>
        )}
        <div className="gd-stat">
          <span className="label">LOGGED SO FAR</span>
          <span className="gd-stat-val">{fmtDur(total)}</span>
          {first && <span className="label">SINCE {fmtDateShort(first)}</span>}
        </div>
      </div>

      {active && (
        <div className="gd-row">
          <span className="label">WEEKLY TARGET</span>
          {canEdit ? (
            <TargetStepper
              value={goal.weekly_target_min}
              onChange={(v) => {
                const id = setWeeklyTarget(store, goal, v);
                showToast(`${goal.name}: ${fmtDur(v)} a week`, id);
              }}
            />
          ) : (
            <strong>{fmtDur(goal.weekly_target_min)}</strong>
          )}
        </div>
      )}

      {active && (
        <div className="gd-section">
          <div className="gd-section-head">
            <span className="label">SUBGOALS</span>
            <span className="label">
              {subs.filter((s) => s.done).length} OF {subs.length}
            </span>
          </div>
          {subs.map((s) => (
            <div key={s.id} className="gd-sub" data-chip="1">
              <input
                type="checkbox"
                className="checkbox"
                checked={s.done}
                disabled={!canEdit}
                aria-label={`${s.done ? 'Done' : 'Not done'}: ${s.title}`}
                onChange={() => toggleSubgoal(store, s)}
              />
              <button className={`gd-sub-title${s.done ? ' done' : ''}`} onClick={() => onEditSub(s)} disabled={!canEdit}>
                {s.title}
              </button>
              <span className="mono gd-sub-when">
                {fmtDateShort(s.start_date)} → {fmtDateShort(s.due_date)}
              </span>
              {canEdit && (
                <button
                  className="icon-btn gd-sub-x"
                  data-x="1"
                  aria-label={`Remove ${s.title}`}
                  onClick={() => {
                    const id = removeSubgoal(store, s);
                    showToast(`Removed “${s.title}”`, id);
                  }}
                >
                  <IconX size={10} />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="gd-sub-add">
              <div className="gd-sub-add-row">
                <input
                  className="input"
                  placeholder="Add a subgoal"
                  aria-label="New subgoal"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSub()}
                />
                <button className="icon-btn" aria-label="Add subgoal" onClick={addSub}>
                  <IconPlus />
                </button>
              </div>
              <div className="gd-sub-add-row mono small">
                <span>FROM</span>
                <input type="date" className="input mono-input" aria-label="Subgoal start date" value={subStart} onChange={(e) => setSubStart(e.target.value)} />
                <span>TO</span>
                <input type="date" className="input mono-input" aria-label="Subgoal end date" value={subDue} onChange={(e) => setSubDue(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="gd-section">
        <div className="gd-section-head">
          <span className="label">SMART</span>
          <span className="label">{smartScore(goal)} OF 5</span>
        </div>
        {SMART_LABELS.map(([k, letter, label]) => {
          const text = String(goal[k] ?? '');
          return (
            <div key={letter} className="gd-smart">
              <span className={`smart-tile${text.trim() ? ' on' : ''}`}>{letter}</span>
              <span>
                <span className="label">{label}</span>
                <span className="gd-smart-text">{text || <span className="muted">Not written yet</span>}</span>
              </span>
            </div>
          );
        })}
        <div className="gd-smart">
          <span className="smart-tile on">T</span>
          <span>
            <span className="label">TIME-BOUND</span>
            <span className="gd-smart-text">
              {fmtDateShort(goal.start_date)} → {fmtDateLong(goal.due_date)}
            </span>
          </span>
        </div>
      </div>

      <div className="gd-actions">
        {canEdit && active && (
          <button className="btn btn-sm btn-solid" onClick={onEdit}>
            EDIT GOAL
          </button>
        )}
        <button className="btn btn-sm btn-outline" onClick={onHistory}>
          HISTORY
        </button>
        {canEdit && !archived && (
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              const id = setAchieved(store, goal, !achieved);
              showToast(achieved ? `Reopened “${goal.name}”` : `Marked “${goal.name}” achieved`, id);
            }}
          >
            {achieved ? 'REOPEN' : 'MARK ACHIEVED'}
          </button>
        )}
        {canEdit && (
          <>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => {
                const id = setArchived(store, goal, !archived);
                showToast(archived ? `Unarchived “${goal.name}”` : `Archived “${goal.name}”`, id);
              }}
            >
              {archived ? 'UNARCHIVE' : 'ARCHIVE'}
            </button>
            <button className="btn btn-sm btn-outline-red" onClick={onDelete}>
              DELETE
            </button>
          </>
        )}
        {!canEdit && <span className="gd-note">Goals are changed in the Mechanics session.</span>}
      </div>
    </aside>
  );
}
