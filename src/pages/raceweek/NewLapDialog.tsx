// NEW LAP (brief §6 Race week): name, optional goal, day, start and end, length presets
// (30M/1H/90M/2H to start, up to five; + adds one, hover shows − to remove), and repeat (session only).
import { useState } from 'react';
import { store, useDB } from '../../data/store';
import { activeGoals, DEFAULT_PRESETS, profileOf } from '../../domain/selectors';
import { atTime, fmtDayShort, fromDayKey, hhmmToMinutes, minutesToHHMM, parseDuration, snap } from '../../lib/time';
import { Dialog } from '../../ui/Dialog';
import { IconPlus, IconX } from '../../ui/icons';

export interface NewLapResult {
  title: string;
  goal_id: string | null;
  day: string | 'tray';
  start: string;
  min: number;
  repeat: number[] | null;
}

const presetLabel = (m: number) => (m % 60 === 0 ? `${m / 60}H` : m > 60 && m % 30 === 0 ? `${m}M` : m >= 60 ? `${Math.floor(m / 60)}H${m % 60}` : `${m}M`);

export function NewLapDialog({
  heading,
  days,
  allowRepeat,
  earliest,
  init,
  onClose,
  onAdd,
}: {
  heading: string;
  days: string[];
  allowRepeat: boolean;
  /** Earliest start allowed for a given day (minutes), e.g. now on today in Mechanics mode. */
  earliest: (day: string) => number;
  init: { day: string | 'tray'; start: string; end: string };
  onClose: () => void;
  onAdd: (r: NewLapResult) => void;
}) {
  const db = useDB();
  const goals = activeGoals(db);
  const profile = profileOf(db);
  const presets = profile?.length_presets ?? DEFAULT_PRESETS;
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState<string | null>(null);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [day, setDay] = useState<string | 'tray'>(init.day);
  const [repeat, setRepeat] = useState<'daily' | 'weekdays' | 'pick' | null>(null);
  const [pick, setPick] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [durText, setDurText] = useState('');
  const [error, setError] = useState('');
  const len = hhmmToMinutes(end) - hhmmToMinutes(start);

  const setPresets = (list: number[]) => {
    if (!profile) return;
    const t = store.tx();
    t.update('profiles', profile.id, { length_presets: list });
    t.commit();
  };
  const usePreset = (m: number) => setEnd(minutesToHHMM(Math.min(24 * 60 - 1, hhmmToMinutes(start) + m)));

  const repeatDays = repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : repeat === 'weekdays' ? [1, 2, 3, 4, 5] : repeat === 'pick' ? pick : null;
  const startMin = hhmmToMinutes(start);
  const tooEarly = day !== 'tray' && !repeatDays && startMin < earliest(day);
  const hint = repeatDays
    ? 'Shows up dotted on each matching day. + keeps it, × skips it.'
    : day === 'tray'
      ? 'Goes into Laps to place. Drag it onto a day when you’re ready.'
      : tooEarly
        ? `That time has passed, so it starts at ${minutesToHHMM(earliest(day))} instead.`
        : '';

  const add = () => {
    if (!title.trim()) return setError('Give the lap a name.');
    if (len < 15) return setError('The end has to be at least 15 minutes after the start.');
    if (repeat === 'pick' && !pick.length) return setError('Pick at least one day.');
    const s = tooEarly ? minutesToHHMM(snap(earliest(day as string), 15)) : start;
    onAdd({ title: title.trim(), goal_id: goal, day, start: s, min: len, repeat: repeatDays });
    onClose();
  };

  return (
    <Dialog label={heading} onClose={onClose} width={640}>
      <span className="label label-red">{heading}</span>
      <input
        className="input big-input"
        autoFocus
        placeholder="Lap name"
        aria-label="Lap name"
        value={title}
        onChange={(e) => (setTitle(e.target.value), setError(''))}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      {goals.length > 0 && (
        <div className="field">
          <span className="label">
            GOAL <span className="muted">· OPTIONAL</span>
          </span>
          <div className="chips" role="group" aria-label="Goal">
            {goals.map((g) => (
              <button key={g.id} className="chip" aria-pressed={goal === g.id} onClick={() => setGoal(goal === g.id ? null : g.id)}>
                <span className="dot" style={{ background: g.color, width: 10, height: 10 }} />
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <span className="label">TIME</span>
        <div className="time-row">
          <input type="time" step={900} className="input mono-input" aria-label="Starts" value={start} onChange={(e) => setStart(e.target.value)} />
          <span>–</span>
          <input type="time" step={900} className="input mono-input" aria-label="Ends" value={end} onChange={(e) => setEnd(e.target.value)} />
          <div className="chips" role="group" aria-label="Length">
            {presets.map((m) => (
              <span key={m} className="preset" data-chip="1">
                <button className="chip mono-chip" aria-pressed={len === m} onClick={() => usePreset(m)}>
                  {presetLabel(m)}
                </button>
                {presets.length > 1 && (
                  <button className="preset-x" aria-label={`Remove the ${presetLabel(m)} preset`} onClick={() => setPresets(presets.filter((p) => p !== m))}>
                    <IconX size={8} />
                  </button>
                )}
              </span>
            ))}
            {presets.length < 5 && (
              <button className="chip chip-add" aria-label="Add a custom length" onClick={() => setAdding(true)}>
                <IconPlus />
              </button>
            )}
          </div>
        </div>
        {adding && (
          <div className="time-row">
            <input
              className="input"
              autoFocus
              placeholder="e.g. 45m or 1h 15m"
              aria-label="Custom length"
              value={durText}
              onChange={(e) => setDurText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click();
                if (e.key === 'Escape') setAdding(false);
              }}
            />
            <button
              className="btn btn-sm btn-solid"
              onClick={() => {
                const m = parseDuration(durText);
                if (!m || m < 15 || m > 600) return setError('Lengths go from 15m to 10h.');
                if (!presets.includes(m)) setPresets([...presets, m].sort((a, b) => a - b).slice(0, 5));
                usePreset(m);
                setAdding(false);
                setDurText('');
              }}
            >
              ADD LENGTH
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setAdding(false)}>
              CANCEL
            </button>
          </div>
        )}
      </div>
      {allowRepeat && (
        <div className="field">
          <span className="label">REPEAT</span>
          <div className="chips" role="group" aria-label="Repeat">
            {(
              [
                ['daily', 'EVERY DAY'],
                ['weekdays', 'WEEKDAYS'],
                ['pick', 'CHOOSE DAYS'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} className="chip mono-chip" aria-pressed={repeat === v} onClick={() => setRepeat(repeat === v ? null : v)}>
                {l}
              </button>
            ))}
          </div>
          {repeat === 'pick' && (
            <div className="chips" role="group" aria-label="Days">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d}
                  className="chip mono-chip round"
                  aria-pressed={pick.includes(d)}
                  aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
                  onClick={() => setPick(pick.includes(d) ? pick.filter((x) => x !== d) : [...pick, d])}
                >
                  {'SMTWTFS'[d]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!repeatDays && (
        <div className="field">
          <span className="label">DAY</span>
          <div className="chips" role="group" aria-label="Day">
            <button className="chip mono-chip" aria-pressed={day === 'tray'} onClick={() => setDay('tray')}>
              NOT YET
            </button>
            {days.map((k) => (
              <button key={k} className="chip mono-chip" aria-pressed={day === k} onClick={() => setDay(k)}>
                {fmtDayShort(fromDayKey(k))}
              </button>
            ))}
          </div>
        </div>
      )}
      {hint && <span className="form-hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
      <div className="dialog-actions">
        <button className="btn btn-outline" onClick={onClose}>
          CANCEL
        </button>
        <button className="btn btn-red" onClick={add}>
          ADD LAP
        </button>
      </div>
    </Dialog>
  );
}

export function lapStartFrom(r: NewLapResult): string | null {
  return r.day === 'tray' ? null : atTime(r.day, r.start).toISOString();
}
