// New-goal form: walks through SMART. A five-letter meter lights up as each part is filled.
// Name, date and target are required (brief §6 Goals).
import { useState } from 'react';
import { store, useDB } from '../../data/store';
import type { Goal } from '../../data/types';
import { createGoal, updateGoal, validateGoal, type GoalFields } from '../../domain/goals';
import { liveGoals } from '../../domain/selectors';
import { dayKey, fmtDur, now, parseDuration } from '../../lib/time';
import { Dialog } from '../../ui/Dialog';
import { Swatches, useBoard } from '../../ui/ColourPicker';
import { showToast } from '../../ui/signals';

export type GoalFormInit = { mode: 'new'; start?: string; due?: string } | { mode: 'edit'; goal: Goal };

const PROMPTS: [keyof GoalFields, string, string, string, string][] = [
  ['smart_s', 'S', 'SPECIFIC', 'What exactly will you achieve?', 'e.g. Pass the JLPT N3 at the July sitting'],
  ['smart_m', 'M', 'MEASURABLE', 'How will you know you’ve done it?', 'e.g. Score at least 95 of 180'],
  ['smart_a', 'A', 'ACHIEVABLE', 'What will it take, and why is it realistic?', 'e.g. Four hours a week; N4 is already done'],
  ['smart_r', 'R', 'RELEVANT', 'Why does this matter to you?', 'e.g. Read Japanese without subtitles'],
];

export function GoalForm({
  init,
  onClose,
  onCreated,
  onAskExtend,
}: {
  init: GoalFormInit;
  onClose: () => void;
  onCreated: (id: string) => void;
  onAskExtend: (goal: Goal, to: string, fields: Partial<Goal>) => void;
}) {
  const db = useDB();
  const board = useBoard();
  const used = liveGoals(db).map((g) => g.color.toUpperCase());
  const freeColor = board.find((c) => !used.includes(c.toUpperCase())) ?? board[0] ?? '#E10600';
  const g = init.mode === 'edit' ? init.goal : null;
  const [f, setF] = useState<GoalFields>(() => ({
    name: g?.name ?? '',
    color: g?.color ?? freeColor,
    smart_s: g?.smart_s ?? '',
    smart_m: g?.smart_m ?? '',
    smart_a: g?.smart_a ?? '',
    smart_r: g?.smart_r ?? '',
    start_date: g?.start_date ?? (init.mode === 'new' ? init.start : undefined) ?? dayKey(now()),
    due_date: g?.due_date ?? (init.mode === 'new' ? init.due : undefined) ?? '',
    weekly_target_min: g?.weekly_target_min ?? 120,
  }));
  const [targetText, setTargetText] = useState(fmtDur(f.weekly_target_min));
  const [error, setError] = useState('');
  const set = <K extends keyof GoalFields>(k: K, v: GoalFields[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setError('');
  };
  const flags = [...PROMPTS.map(([k]) => !!String(f[k]).trim()), /^\d{4}-\d{2}-\d{2}$/.test(f.due_date)];
  const step = (d: number) => {
    const cur = parseDuration(targetText) ?? 120;
    const next = Math.max(30, cur + d);
    setTargetText(fmtDur(next));
  };
  const save = () => {
    const target = parseDuration(targetText) ?? 0;
    const fields = { ...f, name: f.name.trim(), weekly_target_min: Math.min(6000, target) };
    const err = validateGoal(fields, init.mode);
    if (err) return setError(err);
    for (const k of ['smart_s', 'smart_m', 'smart_a', 'smart_r'] as const) fields[k] = fields[k].trim();
    if (g) {
      if (g.status === 'active' && fields.due_date > g.due_date) {
        const { due_date, ...rest } = fields;
        return onAskExtend(g, due_date, rest);
      }
      const id = updateGoal(store, g, fields);
      showToast(`Saved “${fields.name}”`, id);
    } else {
      const r = createGoal(store, fields);
      showToast(`Added goal “${fields.name}”`, r.logId);
      onCreated(r.id);
    }
    onClose();
  };
  return (
    <Dialog label={g ? 'Edit goal' : 'New goal'} onClose={onClose} width={720} className="goal-form">
      <div className="gf-head">
        <h2 className="gf-title">{g ? `EDIT ${g.name.toUpperCase()}` : 'NEW GOAL'}</h2>
        <div className="gf-meter" aria-label={`SMART: ${flags.filter(Boolean).length} of 5 parts filled`}>
          {['S', 'M', 'A', 'R', 'T'].map((l, i) => (
            <span key={l} className={`smart-tile${flags[i] ? ' on' : ''}`}>
              {l}
            </span>
          ))}
          <span className="label">{flags.filter(Boolean).length} OF 5</span>
        </div>
      </div>
      <div className="gf-top">
        <label className="field gf-name">
          <span className="label">NAME</span>
          <input className="input" autoFocus value={f.name} placeholder="Short name, e.g. Japanese" onChange={(e) => set('name', e.target.value)} />
        </label>
        <div className="field">
          <span className="label">COLOUR</span>
          <Swatches value={f.color} onPick={(hex) => set('color', hex)} removable={false} />
        </div>
      </div>
      {PROMPTS.map(([k, letter, label, prompt, ph]) => (
        <div key={k} className="gf-prompt">
          <span className={`smart-tile${String(f[k]).trim() ? ' on' : ''}`}>{letter}</span>
          <label className="field">
            <span className="label">
              {label} <span className="gf-q">{prompt}</span>
            </span>
            <input className="input" value={String(f[k])} placeholder={ph} onChange={(e) => set(k, e.target.value as never)} />
          </label>
        </div>
      ))}
      <div className="gf-prompt">
        <span className={`smart-tile${flags[4] ? ' on' : ''}`}>T</span>
        <div className="gf-t">
          <label className="field">
            <span className="label">
              TIME-BOUND <span className="gf-q">From</span>
            </span>
            <input type="date" className="input mono-input" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} aria-label="Start date" />
          </label>
          <label className="field">
            <span className="label">
              <span className="gf-q">By when?</span>
            </span>
            <input type="date" className="input mono-input" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} aria-label="Deadline" />
          </label>
          <div className="field">
            <span className="label">WEEKLY TARGET</span>
            <div className="stepper">
              <button type="button" className="stepper-btn" aria-label="Lower the weekly target" onClick={() => step(-30)}>
                −
              </button>
              <input className="stepper-input" aria-label="Weekly target, in hours" value={targetText} onChange={(e) => setTargetText(e.target.value)} />
              <button type="button" className="stepper-btn" aria-label="Raise the weekly target" onClick={() => step(30)}>
                +
              </button>
            </div>
          </div>
        </div>
      </div>
      {error && <span className="error-text">{error}</span>}
      <div className="dialog-actions">
        <button className="btn btn-outline" onClick={onClose}>
          CANCEL
        </button>
        <button className="btn btn-red" onClick={save}>
          {g ? 'SAVE GOAL' : 'ADD GOAL'}
        </button>
      </div>
    </Dialog>
  );
}
