// EMERGENCY PIT STOP (brief §5): bring the Mechanics session earlier (pick a day and time), or START NOW.
// The race ends when the session starts. Moving is logged and can be undone today; starting can't.
import { useState } from 'react';
import { store, useDB } from '../data/store';
import { lapsLeftAfter, moveSessionEarlier, startSessionNow } from '../domain/race';
import { liveRace, raceDays } from '../domain/selectors';
import { atTime, dayKey, fmtDayShort, fmtDayTime, now } from '../lib/time';
import { Dialog } from '../ui/Dialog';
import { radioOpen, showToast } from '../ui/signals';

export function PitStop({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const race = liveRace(db);
  const nowD = now();
  const today = dayKey(nowD);
  const sessionAt = race ? new Date(race.session_at) : null;
  const days = race && sessionAt ? raceDays(race).map(dayKey).filter((k) => k >= today && k <= dayKey(sessionAt)) : [];
  const [day, setDay] = useState(today);
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  if (!race || !sessionAt) return null;
  const to = time ? atTime(day, time) : null;
  const n = to ? lapsLeftAfter(store, race, to) : 0;
  return (
    <Dialog label="Emergency pit stop" onClose={onClose} width={520}>
      <span className="label label-red">EMERGENCY PIT STOP</span>
      <h2>Bring the Mechanics session forward?</h2>
      <p>
        It’s set for {fmtDayTime(sessionAt)}. The race ends when the session starts, so laps planned after the new time go to the debrief as unfinished.
        {to && n ? ` That’s ${n} lap${n === 1 ? '' : 's'}.` : ''}
      </p>
      <div className="field">
        <span className="label">NEW TIME</span>
        <div className="chips" role="group" aria-label="Day">
          {days.map((k) => (
            <button key={k} className="chip mono-chip" aria-pressed={day === k} onClick={() => (setDay(k), setError(''))}>
              {k === today ? 'TODAY' : fmtDayShort(new Date(`${k}T00:00`))}
            </button>
          ))}
          <input type="time" step={900} className="input mono-input" aria-label="Session start time" value={time} onChange={(e) => (setTime(e.target.value), setError(''))} />
        </div>
      </div>
      {error && <span className="error-text">{error}</span>}
      <div className="dialog-actions">
        <button
          className="btn btn-red"
          style={{ marginRight: 'auto' }}
          onClick={() => {
            startSessionNow(store, 'pit');
            onClose();
            radioOpen.set(true);
          }}
        >
          START NOW
        </button>
        <button className="btn btn-outline" onClick={onClose}>
          CANCEL
        </button>
        <button
          className="btn btn-solid"
          onClick={() => {
            if (!to) return setError('Pick a time, or START NOW.');
            const r = moveSessionEarlier(store, to, 'home');
            if (!r.ok) return setError(r.reason);
            showToast(`Mechanics session moved to ${fmtDayTime(to)}`, r.logId);
            onClose();
          }}
        >
          MOVE SESSION
        </button>
      </div>
      <span className="sr-only">{fmtDayTime(nowD)}</span>
    </Dialog>
  );
}
