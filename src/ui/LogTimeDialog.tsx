// LOG TIME (Home), EDIT mode with REMOVE THIS TIME, and Race week's "record by hand" for a past
// lap that was never timed. Times are on the lap's day (today for Home).
import { useState } from 'react';
import { store } from '../data/store';
import type { Lap, LapTime } from '../data/types';
import { editTime, logTime, removeTime } from '../domain/laps';
import { addMinutes, atTime, dayKey, hhmm, now } from '../lib/time';
import { Dialog } from './Dialog';
import { showToast } from './signals';

export function LogTimeDialog({
  lap,
  time,
  variant,
  day,
  onClose,
}: {
  lap: Lap;
  time?: LapTime;
  variant: 'log' | 'edit' | 'record';
  /** The day the time belongs to, 'YYYY-MM-DD'. */
  day: string;
  onClose: () => void;
}) {
  const plannedStart = lap.planned_start ? new Date(lap.planned_start) : now();
  const defStart = time ? hhmm(time.started_at) : variant === 'record' ? hhmm(plannedStart) : hhmm(addMinutes(now(), -lap.planned_min));
  const defEnd = time ? hhmm(time.ended_at ?? now()) : variant === 'record' ? hhmm(addMinutes(plannedStart, lap.planned_min)) : hhmm(now());
  const [start, setStart] = useState(defStart);
  const [end, setEnd] = useState(defEnd);
  const [done, setDone] = useState(variant === 'record' ? true : lap.status === 'done');
  const [error, setError] = useState('');

  const save = () => {
    const s = atTime(day, start);
    const e = atTime(day, end);
    if (!(e > s)) return setError('The finish time has to be after the start.');
    if (dayKey(now()) === day && e.getTime() > now().getTime()) return setError('That finish time hasn’t happened yet.');
    const id = time ? editTime(store, lap, time, s, e, done) : logTime(store, lap, s, e, done, variant === 'record' ? 'week' : 'home');
    showToast(time ? `Edited ${lap.title}` : `Logged ${lap.title}`, id);
    onClose();
  };

  const kicker = variant === 'record' ? 'NOT RECORDED LIVE' : variant === 'edit' ? 'EDIT LOGGED TIME' : 'LOG TIME BY HAND';
  const title = variant === 'record' ? `Record “${lap.title}” by hand` : `${variant === 'edit' ? 'Edit time for' : 'Log time for'} “${lap.title}”`;
  const body =
    variant === 'record'
      ? 'This lap’s time passed without the timer running. Enter when you actually did it. The block moves to that time, and the debrief shows it next to the plan.'
      : variant === 'edit'
        ? 'Change when this happened, or whether the lap is complete. The change goes in this race’s log.'
        : 'For time you spent without the timer running. It’s saved as logged by hand.';

  return (
    <Dialog label={title} onClose={onClose} width={520}>
      <span className="label label-red">{kicker}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="row-2">
        <label className="field">
          <span className="label">STARTED</span>
          <input type="time" className="input mono-input" value={start} onChange={(e) => (setStart(e.target.value), setError(''))} />
        </label>
        <label className="field">
          <span className="label">FINISHED</span>
          <input type="time" className="input mono-input" value={end} onChange={(e) => (setEnd(e.target.value), setError(''))} />
        </label>
      </div>
      {variant !== 'record' && (
        <label className="check-row mono">
          <input type="checkbox" className="checkbox" checked={done} onChange={() => setDone(!done)} />
          MARK AS COMPLETE
        </label>
      )}
      {error && <span className="error-text">{error}</span>}
      <div className="dialog-actions">
        {variant === 'edit' && time && (
          <button
            className="btn btn-outline-red"
            style={{ marginRight: 'auto' }}
            onClick={() => {
              const id = removeTime(store, lap, time);
              showToast(`Removed a time from ${lap.title}`, id);
              onClose();
            }}
          >
            REMOVE THIS TIME
          </button>
        )}
        <button className="btn btn-outline" onClick={onClose}>
          CANCEL
        </button>
        <button className="btn btn-red" onClick={save}>
          SAVE TIME
        </button>
      </div>
    </Dialog>
  );
}
