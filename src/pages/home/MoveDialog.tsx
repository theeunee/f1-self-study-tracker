// MOVE TO LATER (brief §5): pick a later day in this race and a start time. The lap stays on its old day
// marked as moved; if it was running, the timer stops and its time is kept.
import { useState } from 'react';
import { store, useDB } from '../../data/store';
import type { Lap } from '../../data/types';
import { moveToLater } from '../../domain/laps';
import { driverRace, lapIsRunning, raceDays } from '../../domain/selectors';
import { atTime, dayKey, fmtDayShort, fmtDayTime, fromDayKey, hhmm, minuteOfDay, minutesToHHMM, now } from '../../lib/time';
import { Dialog } from '../../ui/Dialog';
import { showToast } from '../../ui/signals';

export function MoveDialog({ lap, onClose }: { lap: Lap; onClose: () => void }) {
  const db = useDB();
  const race = driverRace(db);
  const nowD = now();
  const today = dayKey(nowD);
  const sessionAt = race ? new Date(race.session_at) : null;
  const options = race
    ? raceDays(race)
        .map(dayKey)
        .filter((k) => k >= today && (!sessionAt || k <= dayKey(sessionAt)))
        .filter((k) => k !== today || minuteOfDay(nowD) < 22 * 60)
    : [];
  const wasRunning = lapIsRunning(db, lap);
  const origMin = lap.planned_start ? minuteOfDay(lap.planned_start) : 9 * 60;
  const [day, setDay] = useState(options[0] ?? today);
  const [time, setTime] = useState(
    minutesToHHMM(options[0] === today ? Math.max(origMin + 60, Math.ceil((minuteOfDay(nowD) + 15) / 15) * 15) : origMin),
  );
  const [error, setError] = useState('');
  const fromDay = lap.planned_start ? fmtDayShort(new Date(lap.planned_start)) : 'today';
  const save = () => {
    const to = atTime(day, time);
    if (to.getTime() <= nowD.getTime()) return setError('Pick a time later than now.');
    if (lap.planned_start && to.getTime() <= new Date(lap.planned_start).getTime()) return setError('Pick a time later than where it is now.');
    if (sessionAt && to.getTime() >= sessionAt.getTime()) return setError(`The race ends at the Mechanics session (${fmtDayTime(sessionAt)}).`);
    const id = moveToLater(store, lap, to);
    showToast(`Moved ${lap.title} · ${fmtDayTime(to)}`, id);
    onClose();
  };
  return (
    <Dialog label={`Move ${lap.title}`} onClose={onClose} width={560}>
      <span className="label label-red">MOVE TO LATER</span>
      <h2>Move “{lap.title}”</h2>
      <div className="field">
        <span className="label">DAY</span>
        <div className="chips" role="group" aria-label="Day">
          {options.map((k) => (
            <button key={k} className="chip mono-chip" aria-pressed={day === k} onClick={() => (setDay(k), setError(''))}>
              {fmtDayShort(fromDayKey(k))}
              {k === today ? ' · LATER TODAY' : ''}
            </button>
          ))}
          {!options.length && <span className="muted">No days left in this race.</span>}
        </div>
      </div>
      <label className="field" style={{ maxWidth: 200 }}>
        <span className="label">STARTS</span>
        <input type="time" step={900} className="input mono-input" value={time} onChange={(e) => (setTime(e.target.value), setError(''))} />
      </label>
      <p>
        It stays on {fromDay} marked as moved, and the move is logged for your debrief.
        {wasRunning ? ' The timer stops; the time you’ve done stays recorded.' : ''}
      </p>
      {error && <span className="error-text">{error}</span>}
      <div className="dialog-actions">
        <button className="btn btn-outline" onClick={onClose}>
          CANCEL
        </button>
        <button className="btn btn-solid" onClick={save} disabled={!options.length}>
          MOVE LAP
        </button>
      </div>
      <span className="sr-only">{hhmm(nowD)}</span>
    </Dialog>
  );
}
