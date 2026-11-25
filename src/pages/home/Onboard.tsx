// ONBOARD (brief §6 Home): a full-screen black view of the running lap. With nothing running it shows
// the time with seconds; START NEXT LAP first shows the lap, with START LAP / NOT YET. Esc closes it.
import { useState } from 'react';
import { store, useDB } from '../../data/store';
import { activeLap, lapCounter, nextLapToday } from '../../domain/active';
import { keepGoing, pauseRunning, setAutoEnd, startLap } from '../../domain/laps';
import { driverRace, goalOf, raceLabel, recordedMs } from '../../domain/selectors';
import { onboardLine } from '../../radio/lines';
import { useEscape, useNow } from '../../lib/hooks';
import { MIN, addMinutes, fmtTimer, hhmm, hhmmss } from '../../lib/time';

export function Onboard({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const nowD = useNow(250);
  const nowMs = nowD.getTime();
  const [confirming, setConfirming] = useState(false);
  useEscape(onClose);
  const race = driverRace(db);
  const a = activeLap(db, nowMs);
  const next = nextLapToday(db, nowMs, a?.lap.id);
  const c = lapCounter(db, nowMs);
  const goal = a ? goalOf(db, a.lap.goal_id) : undefined;
  const pct = a ? Math.min(100, (recordedMs(db, a.lap.id, nowMs) / (a.lap.planned_min * MIN)) * 100) : 0;
  const nGoal = next ? goalOf(db, next.goal_id) : undefined;
  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="Onboard view">
      <span className="ob-corner tr" aria-hidden="true" />
      <span className="ob-corner bl" aria-hidden="true" />
      {race && (
        <span className="ob-num display" aria-hidden="true">
          {String(race.number).padStart(2, '0')}
        </span>
      )}
      <div className="ob-top">
        <span className="mono ob-tag">
          <span className="ob-dot" /> ONBOARD
        </span>
        <span className="mono ob-lapno">
          {raceLabel(race)} · LAP {Math.min(c.total, c.done + 1)} OF {c.total}
        </span>
        <button className="btn btn-outline ob-exit" onClick={onClose}>
          EXIT ONBOARD · ESC
        </button>
      </div>
      {a ? (
        <div className="ob-main">
          <span className="mono ob-goal">
            <span className="dot" style={{ background: goal?.color ?? '#8F8F97', boxShadow: '0 0 0 2px #fff' }} />
            {(goal?.name ?? 'NO GOAL').toUpperCase()}
          </span>
          <span className="ob-title">{a.lap.title}</span>
          <span role="timer" aria-label="Time on this lap" className={`ob-timer${a.remainingMs < 0 ? ' over' : ''}`}>
            {a.remainingMs < 0 ? `+${fmtTimer(-a.remainingMs)}` : fmtTimer(a.remainingMs)}
          </span>
          <span className="mono ob-leftof">
            {a.remainingMs > 0 ? `LEFT OF ${a.lap.planned_min}:00` : a.autoEnded ? `AUTO-ENDED AT ${a.lap.planned_min}:00` : `OVER ${a.lap.planned_min}:00 · STILL RECORDING`}
          </span>
          <div className="ob-track" aria-hidden="true">
            <div className="ob-fill" style={{ width: `${pct}%` }} />
            <span className="ob-knob" style={{ left: `${pct}%` }} />
            <span className="ob-tick" style={{ left: '33.3%' }} />
            <span className="ob-tick" style={{ left: '66.6%' }} />
          </div>
          <div className="ob-controls">
            <label className="ob-auto mono">
              <input type="checkbox" className="checkbox" checked={a.lap.auto_end} onChange={() => setAutoEnd(store, a.lap, !a.lap.auto_end)} />
              AUTO-END
            </label>
            <button
              className="btn btn-red ob-run"
              onClick={() => (a.autoEnded ? keepGoing(store, a.lap) : a.running ? pauseRunning(store) : startLap(store, a.lap))}
            >
              {a.autoEnded ? 'KEEP GOING' : a.running ? 'PAUSE' : 'RESUME'}
            </button>
          </div>
        </div>
      ) : (
        <div className="ob-main">
          {!confirming ? (
            <>
              <span className="mono ob-leftof">NO LAP RUNNING</span>
              <span role="timer" aria-label="Current time" className="ob-timer clock">
                {hhmmss(nowD)}
              </span>
              {next && (
                <button className="btn btn-red ob-run" onClick={() => setConfirming(true)}>
                  START NEXT LAP
                </button>
              )}
            </>
          ) : (
            next && (
              <div className="ob-confirm" role="group" aria-labelledby="ob-confirm-h">
                <span className="mono ob-leftof">READY TO START?</span>
                <span className="mono ob-goal">
                  <span className="dot" style={{ background: nGoal?.color ?? '#8F8F97' }} />
                  {(nGoal?.name ?? 'NO GOAL').toUpperCase()}
                </span>
                <h2 id="ob-confirm-h" className="ob-title">
                  {next.title}
                </h2>
                <span className="mono ob-leftof">
                  {hhmm(next.planned_start!)}–{hhmm(addMinutes(next.planned_start!, next.planned_min))}
                </span>
                {next.description && <p className="ob-desc">{next.description}</p>}
                <div className="ob-controls">
                  <button
                    className="btn btn-red ob-run"
                    onClick={() => {
                      startLap(store, next);
                      setConfirming(false);
                    }}
                  >
                    START LAP
                  </button>
                  <button className="btn btn-outline ob-exit" onClick={() => setConfirming(false)}>
                    NOT YET
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
      <div className="ob-bottom">
        <span className="mono ob-next">{next ? `UP NEXT · ${hhmm(next.planned_start!)} · ${next.title}` : 'NOTHING ELSE PLANNED TODAY'}</span>
        <span className="ob-radio">
          <span className="mono red-text">RACE ENGINEER · </span>
          {onboardLine(db, nowMs)}
        </span>
      </div>
    </div>
  );
}
