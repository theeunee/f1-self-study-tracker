import { useMemo, useState } from 'react';
import { store, useDB } from '../../data/store';
import type { Goal, Subgoal } from '../../data/types';
import {
  deleteGoal,
  reorderGoals,
  setArchived,
  setGoalColor,
  toggleSubgoal,
  updateGoal,
  daysBetween,
} from '../../domain/goals';
import { inSession, liveGoals, totalWeeklyTarget } from '../../domain/selectors';
import { usePref } from '../../lib/hooks';
import { fmtDateShort, fmtDur, fromDayKey } from '../../lib/time';
import { ColourPopover } from '../../ui/ColourPicker';
import { ConfirmDialog } from '../../ui/Dialog';
import { IconLock, IconPlus } from '../../ui/icons';
import { showToast } from '../../ui/signals';
import { HeaderActions } from '../../shell/Shell';
import { Timeline, type Zoom } from './Timeline';
import { GoalDetail } from './GoalDetail';
import { GoalList } from './GoalList';
import { GoalForm, type GoalFormInit } from './GoalForm';
import { SubgoalForm, type SubFormInit } from './SubgoalForm';
import { HistoryDialog } from './History';
import './goals.css';

export function GoalsPage() {
  const db = useDB();
  /** Editing goals is only allowed in the Mechanics session (brief §5, slice 1 `canEdit`). */
  const canEdit = inSession(db);
  const [view, setView] = usePref<'timeline' | 'list'>('goals.view', 'timeline');
  const [zoom, setZoom] = usePref<Zoom>('goals.zoom', 'month');
  const [folded, setFolded] = usePref('goals.folded', false);
  const [hiddenSubs, setHiddenSubs] = usePref<Record<string, boolean>>('goals.hiddenSubs', {});
  const [filter, setFilter] = usePref('goals.filter', { hideAchieved: false, hideArchived: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [colourFor, setColourFor] = useState<{ goal: Goal; el: HTMLElement } | null>(null);
  const [form, setForm] = useState<GoalFormInit | null>(null);
  const [subForm, setSubForm] = useState<SubFormInit | null>(null);
  const [extend, setExtend] = useState<{ goal: Goal; to: string; fields?: Partial<Goal> } | null>(null);
  const [del, setDel] = useState<Goal | null>(null);
  const [history, setHistory] = useState<Goal | null>(null);

  const all = liveGoals(db);
  const active = all.filter((g) => g.status === 'active');
  const achieved = all.filter((g) => g.status === 'achieved');
  const archived = all.filter((g) => g.status === 'archived');
  const shown = useMemo(
    () => all.filter((g) => !(filter.hideAchieved && g.status === 'achieved') && !(filter.hideArchived && g.status === 'archived')),
    [all, filter],
  );
  const sel = all.find((g) => g.id === selected) ?? null;

  const counts = `${active.length} ACTIVE · ${achieved.length} ACHIEVED${archived.length ? ` · ${archived.length} ARCHIVED` : ''}`;
  const weekly = `${fmtDur(totalWeeklyTarget(db)).toUpperCase()} A WEEK ACROSS ACTIVE GOALS`;

  const openSubEdit = (s: Subgoal) => {
    if (!canEdit) return;
    setSubForm({ mode: 'edit', goalId: s.goal_id, sub: s, title: s.title, start: s.start_date, due: s.due_date, done: s.done });
  };

  return (
    <div className="goals-page">
      <HeaderActions>{null}</HeaderActions>
      <section className="page-bar" aria-label="Goals summary">
        <h1 className="page-title">GOALS</h1>
        <span className="page-sub">{counts}</span>
        <span className="page-sub red-text">{weekly}</span>
        <div className="page-bar-right">
          <div className="seg" role="group" aria-label="View">
            {(['timeline', 'list'] as const).map((v) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
          {view === 'timeline' && (
            <div className="seg" role="group" aria-label="Time scale">
              {(['week', 'month', 'quarter', 'year'] as const).map((z) => (
                <button key={z} aria-pressed={zoom === z} onClick={() => setZoom(z)}>
                  {z.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {canEdit ? (
            <button className="btn btn-red" onClick={() => setForm({ mode: 'new' })}>
              <IconPlus size={12} /> NEW GOAL
            </button>
          ) : (
            <span className="view-only mono" title="Goals are changed in the Mechanics session">
              <IconLock size={12} /> VIEW ONLY · EDIT IN THE MECHANICS SESSION
            </span>
          )}
        </div>
      </section>

      <section className={`goals-body${sel ? ' with-detail' : ''}`} aria-label="Goals">
        {!all.length ? (
          <div className="goals-empty glass">
            <p className="goals-empty-title">No goals yet</p>
            <p>Add a long-term goal and give it a weekly hour target. Race week plans each race around it.</p>
            {canEdit ? (
              <button className="btn btn-red" onClick={() => setForm({ mode: 'new' })}>
                NEW GOAL
              </button>
            ) : (
              <p className="muted">Goals are added in the Mechanics session.</p>
            )}
          </div>
        ) : view === 'timeline' ? (
          <Timeline
            goals={shown}
            zoom={zoom}
            canEdit={canEdit}
            selected={selected}
            onSelect={setSelected}
            folded={folded}
            onFold={() => setFolded((f) => !f)}
            hidden={hiddenSubs}
            onToggleSubs={(id) => setHiddenSubs((h) => ({ ...h, [id]: !h[id] }))}
            filter={filter}
            onFilter={setFilter}
            counts={{ achieved: achieved.length, archived: archived.length }}
            onColour={(goal, el) => setColourFor({ goal, el })}
            onReorder={(ids) => {
              // Keep hidden goals in place: reorder only the visible ones among all.
              const hiddenIds = all.filter((g) => !ids.includes(g.id)).map((g) => g.id);
              reorderGoals(store, [...ids, ...hiddenIds]);
            }}
            onNewGoal={(start, due) => setForm({ mode: 'new', start, due })}
            onNewSub={(goal, start, due) => setSubForm({ mode: 'new', goalId: goal.id, title: '', start, due, done: false })}
            onEditSub={openSubEdit}
            onToggleSub={(s) => canEdit && toggleSubgoal(store, s)}
            onExtend={(goal, to) => setExtend({ goal, to })}
          />
        ) : (
          <GoalList active={active} achieved={achieved} archived={archived} selected={selected} onSelect={setSelected} />
        )}
        {sel && (
          <GoalDetail
            goal={sel}
            canEdit={canEdit}
            onClose={() => setSelected(null)}
            onColour={(el) => setColourFor({ goal: sel, el })}
            onEdit={() => setForm({ mode: 'edit', goal: sel })}
            onHistory={() => setHistory(sel)}
            onDelete={() => setDel(sel)}
            onEditSub={openSubEdit}
          />
        )}
      </section>

      {colourFor && (
        <ColourPopover
          anchor={colourFor.el}
          title={`${colourFor.goal.name.toUpperCase()} · COLOUR`}
          value={colourFor.goal.color}
          onPick={(hex) => setGoalColor(store, colourFor.goal, hex)}
          onClose={() => setColourFor(null)}
        />
      )}
      {form && (
        <GoalForm
          init={form}
          onClose={() => setForm(null)}
          onCreated={(id) => setSelected(id)}
          onAskExtend={(goal, to, fields) => setExtend({ goal, to, fields })}
        />
      )}
      {subForm && <SubgoalForm init={subForm} onClose={() => setSubForm(null)} />}
      {extend && (
        <ConfirmDialog
          kicker="MOVE THE FINISH LINE?"
          title={`${extend.goal.name}: ${fmtDateShort(extend.goal.due_date)} → ${fmtDateShort(extend.to)}`}
          body={`That gives you ${daysBetween(extend.goal.due_date, extend.to)} more days. The move is recorded in ${extend.goal.name}’s history, so you can see later that the finish line moved.`}
          cancelLabel="KEEP THE DATE"
          confirmLabel="MOVE DEADLINE"
          onCancel={() => setExtend(null)}
          onConfirm={() => {
            const id = updateGoal(store, extend.goal, { ...(extend.fields ?? {}), due_date: extend.to }, `Moved ${extend.goal.name}’s deadline`);
            showToast(`${extend.goal.name} now ends ${fmtDateShort(extend.to)} · noted in its history`, id);
            setExtend(null);
            setForm(null);
          }}
        />
      )}
      {del && (
        <ConfirmDialog
          kicker="DELETE GOAL"
          title={`Delete “${del.name}”?`}
          body="Laps you’ve already done keep their recorded time, but they won’t count toward any goal. Archiving keeps everything and hides it from the timeline. You can undo right after."
          confirmLabel="DELETE GOAL"
          danger
          extra={
            del.status !== 'archived' && (
              <button
                className="btn btn-outline"
                onClick={() => {
                  const id = setArchived(store, del, true);
                  showToast(`Archived “${del.name}”`, id);
                  setDel(null);
                }}
              >
                ARCHIVE INSTEAD
              </button>
            )
          }
          onCancel={() => setDel(null)}
          onConfirm={() => {
            const id = deleteGoal(store, del);
            showToast(`Deleted “${del.name}”`, id);
            setSelected(null);
            setDel(null);
          }}
        />
      )}
      {history && <HistoryDialog goal={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

export function plainDate(key: string) {
  const d = fromDayKey(key);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
