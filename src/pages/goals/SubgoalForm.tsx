import { useState } from 'react';
import { store, useDB } from '../../data/store';
import type { Subgoal } from '../../data/types';
import { addSubgoal, removeSubgoal, updateSubgoal } from '../../domain/goals';
import { goalOf } from '../../domain/selectors';
import { Dialog } from '../../ui/Dialog';
import { showToast } from '../../ui/signals';

export type SubFormInit = { mode: 'new' | 'edit'; goalId: string; sub?: Subgoal; title: string; start: string; due: string; done: boolean };

export function SubgoalForm({ init, onClose }: { init: SubFormInit; onClose: () => void }) {
  const db = useDB();
  const goal = goalOf(db, init.goalId);
  const [v, setV] = useState(init);
  const [error, setError] = useState('');
  if (!goal) return null;
  const save = () => {
    if (!v.title.trim()) return setError('Give the subgoal a name.');
    if (!v.start || !v.due || v.due <= v.start) return setError('The end date has to be after the start.');
    if (init.mode === 'edit' && init.sub) {
      const id = updateSubgoal(store, init.sub, { title: v.title.trim(), start_date: v.start, due_date: v.due, done: v.done });
      showToast(`Saved “${v.title.trim()}”`, id);
    } else {
      const id = addSubgoal(store, goal, v.title, v.start, v.due);
      showToast(`Added “${v.title.trim()}”`, id);
    }
    onClose();
  };
  return (
    <Dialog label="Subgoal" onClose={onClose} width={480}>
      <span className="label label-red">
        {init.mode === 'edit' ? 'EDIT SUBGOAL · ' : 'NEW SUBGOAL · '}
        {goal.name.toUpperCase()}
      </span>
      <input className="input" autoFocus aria-label="Subgoal" placeholder="e.g. Pass a full practice test" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
      <div className="row-2">
        <label className="field">
          <span className="label">FROM</span>
          <input type="date" className="input mono-input" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">BY</span>
          <input type="date" className="input mono-input" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} />
        </label>
      </div>
      {init.mode === 'edit' && (
        <label className="check-row">
          <input type="checkbox" className="checkbox" checked={v.done} onChange={() => setV({ ...v, done: !v.done })} />
          DONE
        </label>
      )}
      {error && <span className="error-text">{error}</span>}
      <div className="dialog-actions">
        {init.mode === 'edit' && init.sub && (
          <button
            className="btn btn-outline-red"
            style={{ marginRight: 'auto' }}
            onClick={() => {
              const id = removeSubgoal(store, init.sub!);
              showToast(`Removed “${init.sub!.title}”`, id);
              onClose();
            }}
          >
            DELETE SUBGOAL
          </button>
        )}
        <button className="btn btn-outline" onClick={onClose}>
          CANCEL
        </button>
        <button className="btn btn-red" onClick={save}>
          {init.mode === 'edit' ? 'SAVE' : 'ADD SUBGOAL'}
        </button>
      </div>
    </Dialog>
  );
}
