import { useState } from 'react';
import { useDB } from '../../data/store';
import type { Lap, LapTime } from '../../data/types';
import { lapCounter } from '../../domain/active';
import { driverRace, inSession, raceLabel } from '../../domain/selectors';
import { useNowMs, usePref } from '../../lib/hooks';
import { DAY_SHORT, MONTH_SHORT, dayKey, now } from '../../lib/time';
import { HeaderActions, todaySignal } from '../../shell/Shell';
import { DDay } from '../../ui/DDay';
import { LogTimeDialog } from '../../ui/LogTimeDialog';
import { IconCamera } from '../../ui/icons';
import { Debrief } from '../../session/Debrief';
import { LapsPanel } from './LapsPanel';
import { MonthCalendar } from './MonthCalendar';
import { MoveDialog } from './MoveDialog';
import { Onboard } from './Onboard';
import { RacePlan } from './RacePlan';
import './home.css';

const CAL_MIN = 380;
const CAL_MAX = 760;

export function HomePage() {
  const db = useDB();
  const nowMs = useNowMs(1000);
  const todayTick = todaySignal.use();
  const [selected, setSelected] = useState(() => dayKey(now()));
  const [calW, setCalW] = usePref('home.calW', 540);
  const [log, setLog] = useState<{ lap: Lap; time?: LapTime } | null>(null);
  const [move, setMove] = useState<Lap | null>(null);
  const [plan, setPlan] = useState(false);
  const [onboard, setOnboard] = useState(false);
  const [lastTick, setLastTick] = useState(todayTick);
  if (todayTick !== lastTick) {
    setLastTick(todayTick);
    setSelected(dayKey(nowMs));
  }

  if (inSession(db)) return <Debrief />;

  const race = driverRace(db);
  const c = lapCounter(db, nowMs);
  const d = new Date(nowMs);
  const startSplit = (e: React.PointerEvent) => {
    const x0 = e.clientX;
    const w0 = calW;
    const move = (ev: PointerEvent) => setCalW(Math.max(CAL_MIN, Math.min(CAL_MAX, w0 + ev.clientX - x0)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="home">
      <HeaderActions>
        <button className="btn btn-solid" onClick={() => setOnboard(true)} aria-label="Onboard: full-screen view of the running lap">
          <IconCamera /> ONBOARD
        </button>
      </HeaderActions>
      <section className="banner" aria-label="Today and countdown">
        <div className="banner-today">
          <span className="mono banner-kicker">TODAY</span>
          <span className="display banner-date">
            {DAY_SHORT[d.getDay()]} {d.getDate()} {MONTH_SHORT[d.getMonth()]}
          </span>
        </div>
        <div className="banner-rule" aria-hidden="true" />
        <DDay variant="banner" />
        {race && (
          <div className="banner-race">
            <span className="display banner-race-no">{raceLabel(race)}</span>
            <span className="mono banner-progress">
              {c.done} OF {c.total} LAPS DONE
            </span>
            <button className="btn-link" onClick={() => setPlan(true)}>
              RACE PLAN
            </button>
          </div>
        )}
      </section>
      <div className="home-body">
        <div style={{ width: calW, flex: 'none', display: 'flex' }}>
          <MonthCalendar selected={selected} onSelect={setSelected} nowMs={nowMs} todayTick={todayTick} />
        </div>
        <div
          className="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the calendar and the laps"
          aria-valuenow={calW}
          aria-valuemin={CAL_MIN}
          aria-valuemax={CAL_MAX}
          tabIndex={0}
          onPointerDown={startSplit}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setCalW((w) => Math.max(CAL_MIN, w - 20));
            if (e.key === 'ArrowRight') setCalW((w) => Math.min(CAL_MAX, w + 20));
          }}
          title="Drag to resize"
        >
          <span />
        </div>
        <LapsPanel
          day={selected}
          nowMs={nowMs}
          onLog={(lap) => setLog({ lap })}
          onEditTime={(lap, time) => setLog({ lap, time })}
          onMove={(lap) => setMove(lap)}
        />
      </div>
      {log && <LogTimeDialog lap={log.lap} time={log.time} variant={log.time ? 'edit' : 'log'} day={selected} onClose={() => setLog(null)} />}
      {move && <MoveDialog lap={move} onClose={() => setMove(null)} />}
      {plan && <RacePlan onClose={() => setPlan(false)} />}
      {onboard && <Onboard onClose={() => setOnboard(false)} />}
    </div>
  );
}
