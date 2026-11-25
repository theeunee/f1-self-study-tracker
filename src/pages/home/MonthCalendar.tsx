// Month calendar (brief §6 Home): scrolls endlessly with no visible scrollbar; the current race is one
// continuous band starting Sunday; marks show time recorded, all laps done and the Mechanics session day.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDB } from '../../data/store';
import { lapsOnDay } from '../../domain/active';
import { driverRace, lapIsDone, raceDays } from '../../domain/selectors';
import { MONTH_LONG, MONTH_SHORT, addDays, dayKey, startOfWeek } from '../../lib/time';
import { IconCheck } from '../../ui/icons';

const ROW = 56;

export function MonthCalendar({
  selected,
  onSelect,
  nowMs,
  todayTick,
}: {
  selected: string;
  onSelect: (k: string) => void;
  nowMs: number;
  todayTick: number;
}) {
  const db = useDB();
  const scroller = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState({ before: 26, after: 26 });
  const base = startOfWeek(nowMs);
  const first = addDays(base, -7 * span.before);
  const weeks = span.before + span.after;
  const todayKey = dayKey(nowMs);
  const race = driverRace(db);
  const band = useMemo(() => new Set(race ? raceDays(race).map(dayKey) : []), [race]);

  // Marks per day.
  const marks = useMemo(() => {
    const work = new Set<string>();
    for (const t of db.lap_times) work.add(dayKey(t.started_at));
    const mech = new Set<string>();
    for (const r of db.races) mech.add(dayKey(r.ended_at ?? r.session_at));
    return { work, mech };
  }, [db]);
  const allDone = (k: string) => {
    const laps = lapsOnDay(db, k).filter((l) => l.status !== 'moved');
    return laps.length > 0 && laps.every((l) => lapIsDone(db, l, nowMs));
  };

  const [month, setMonth] = useState(() => new Date(nowMs));
  const scrollToToday = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = span.before * ROW - ROW * 4;
  };
  useLayoutEffect(scrollToToday, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (todayTick) scrollToToday();
  }, [todayTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the view still when weeks are added above.
  const prevBefore = useRef(span.before);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && span.before > prevBefore.current) el.scrollTop += (span.before - prevBefore.current) * ROW;
    prevBefore.current = span.before;
  }, [span.before]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const topRow = Math.floor((el.scrollTop + ROW * 1.5) / ROW);
    setMonth(addDays(first, topRow * 7 + 6));
    if (el.scrollTop < ROW * 4) setSpan((s) => ({ ...s, before: s.before + 26 }));
    else if (el.scrollTop + el.clientHeight > el.scrollHeight - ROW * 4) setSpan((s) => ({ ...s, after: s.after + 26 }));
  };

  return (
    <section className="cal glass" aria-labelledby="cal-h">
      <h2 id="cal-h" className="cal-month mono">
        {MONTH_LONG[month.getMonth()].toUpperCase()} {month.getFullYear()}
      </h2>
      <div className="cal-wd mono" aria-hidden="true">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-scroll no-scrollbar" ref={scroller} onScroll={onScroll}>
        <div className="cal-grid" style={{ height: weeks * ROW }}>
          {Array.from({ length: weeks }, (_, w) => {
            const rowStart = addDays(first, w * 7);
            const inBand = band.has(dayKey(rowStart));
            return (
              <div key={dayKey(rowStart)} className={`cal-row${inBand ? ' band' : ''}`}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(rowStart, i);
                  const k = dayKey(d);
                  const isToday = k === todayKey;
                  const muted = d.getMonth() !== month.getMonth();
                  const done = allDone(k);
                  return (
                    <button
                      key={k}
                      className={`cal-day${isToday ? ' today' : ''}${k === selected ? ' selected' : ''}${muted ? ' muted' : ''}`}
                      aria-label={`${d.toDateString()}${marks.work.has(k) ? ', time recorded' : ''}${done ? ', all laps done' : ''}${marks.mech.has(k) ? ', Mechanics session' : ''}`}
                      aria-pressed={k === selected}
                      onClick={() => onSelect(k)}
                    >
                      {d.getDate() === 1 && <span className="cal-mtag mono">{MONTH_SHORT[d.getMonth()]}</span>}
                      <span className="cal-num">{d.getDate()}</span>
                      <span className="cal-marks" aria-hidden="true">
                        {marks.work.has(k) && <span className="cal-dot" />}
                        {done && <IconCheck size={10} />}
                        {marks.mech.has(k) && <span className="cal-flag" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cal-legend mono">
        <span>
          <span className="cal-dot" /> TIME RECORDED
        </span>
        <span>
          <IconCheck size={10} /> ALL LAPS DONE
        </span>
        <span>
          <span className="cal-flag" /> MECHANICS
        </span>
        <span>
          <span className="cal-band-key" /> THIS RACE
        </span>
      </div>
    </section>
  );
}
