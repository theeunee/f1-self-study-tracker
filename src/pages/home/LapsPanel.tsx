import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { store, useDB } from '../../data/store';
import type { Lap, LapTime } from '../../data/types';
import { activeLap, lapsOnDay } from '../../domain/active';
import { addCalendarEvent, calendarEvents, calendarGhosts, dismissCalendarEvent } from '../../domain/calendar';
import { keepGhost, repeatGhosts, skipGhost } from '../../domain/repeats';
import { keepGoing, pauseRunning, setAutoEnd, startLap } from '../../domain/laps';
import { driverRace, goalOf, lapIsDone, lapIsRunning, lapPlacedMin, lapPlacedStart, recordedMin, timesOf } from '../../domain/selectors';
import { usePref } from '../../lib/hooks';
import { MIN, addMinutes, dayKey, fmtDur, fmtTimer, fromDayKey, hhmm, minuteOfDay, pad2 } from '../../lib/time';
import { IconCheck, IconEdit, IconPlus, IconX } from '../../ui/icons';
import { showToast } from '../../ui/signals';
import type { CalGhost } from '../raceweek/WeekGrid';
import type { Ghost } from '../../domain/repeats';

const HOUR = 56;
const H0 = 7 * 60;
const H1 = 23 * 60;
const TOP = (m: number) => Math.round(((m - H0) / 60) * HOUR);

export function deltaPill(d: number): { text: string; cls: string } {
  const r = Math.round(d);
  if (r === 0) return { text: 'ON PLAN', cls: 'pill-on' };
  if (r > 0) return { text: `+${fmtDur(r).toUpperCase()} OVER`, cls: 'pill-over' };
  return { text: `−${fmtDur(-r).toUpperCase()} UNDER`, cls: 'pill-under' };
}

export function LapsPanel({
  day,
  nowMs,
  onLog,
  onEditTime,
  onMove,
}: {
  day: string;
  nowMs: number;
  onLog: (lap: Lap) => void;
  onEditTime: (lap: Lap, t: LapTime) => void;
  onMove: (lap: Lap) => void;
}) {
  const db = useDB();
  const [view, setView] = usePref<'hours' | 'list'>('home.view', 'hours');
  const [open, setOpen] = useState<string | null>(null);
  const calEvents = calendarEvents.use();
  const todayKey = dayKey(nowMs);
  const when = day === todayKey ? 'today' : day < todayKey ? 'past' : 'future';
  const laps = lapsOnDay(db, day);
  const race = driverRace(db);
  const ghosts: (Ghost | CalGhost)[] = [
    ...repeatGhosts(db, race).filter((g) => g.date === day),
    ...calendarGhosts(db, calEvents, [fromDayKey(day)]),
  ];
  const real = laps.filter((l) => l.status !== 'moved');
  const doneCount = real.filter((l) => lapIsDone(db, l, nowMs)).length;
  const rec = real.reduce((s, l) => s + recordedMin(db, l.id, nowMs), 0);
  const est = real.reduce((s, l) => s + l.planned_min, 0);
  const allDone = real.length > 0 && doneCount === real.length;
  const showDayPill = real.length > 0 && (when === 'past' || allDone || rec > est);
  const pill = deltaPill(rec - est);
  const act = activeLap(db, nowMs);
  const d = fromDayKey(day);
  const title = when === 'today' ? 'TODAY’S LAPS' : d.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase().replace(/^(\w+) (\d+) (\w+)$/, '$1, $3 $2');

  const sessionHere = race && race.status !== 'done' && dayKey(race.session_at) === day;

  return (
    <section className="laps glass" aria-labelledby="laps-h">
      <div className="laps-head">
        <h2 id="laps-h" className="mono">
          {title}
        </h2>
        {laps.length > 0 && (
          <span className="mono laps-sum">
            {doneCount} OF {real.length} DONE · {fmtDur(rec)} / {fmtDur(est)}
          </span>
        )}
        {showDayPill && <span className={`mono pill ${pill.cls}`}>{pill.text}</span>}
        <div className="seg laps-seg" role="group" aria-label="View">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
            LIST
          </button>
          <button aria-pressed={view === 'hours'} onClick={() => setView('hours')}>
            HOURS
          </button>
        </div>
      </div>
      {!laps.length && !ghosts.length ? (
        <div className="laps-empty">
          <p className="laps-empty-title">{sessionHere ? `Mechanics session · ${hhmm(race!.session_at)}` : 'No laps on this day'}</p>
          <p>
            {sessionHere
              ? 'Review this race and plan the next one. You can still time laps earlier in the day.'
              : when === 'past'
                ? 'Nothing was planned here.'
                : 'Laps are planned in the Mechanics session, or in Race week’s Mechanics mode.'}
          </p>
        </div>
      ) : view === 'hours' ? (
        <HoursView
          day={day}
          laps={laps}
          ghosts={ghosts}
          when={when}
          nowMs={nowMs}
          activeId={act?.lap.id ?? null}
          onLog={onLog}
          onMove={onMove}
          onOpen={(id) => {
            setOpen(id);
            setView('list');
          }}
        />
      ) : (
        <ListView laps={laps} ghosts={ghosts} when={when} nowMs={nowMs} open={open} setOpen={setOpen} onLog={onLog} onEditTime={onEditTime} onMove={onMove} />
      )}
    </section>
  );
}

function sub(db: ReturnType<typeof useDB>, l: Lap) {
  const s = lapPlacedStart(db, l)!;
  const g = goalOf(db, l.goal_id);
  return `${hhmm(s)}–${hhmm(addMinutes(s, l.planned_min))} · ${(g?.name ?? (l.source === 'calendar' ? 'CALENDAR' : 'NO GOAL')).toUpperCase()}`;
}

function Timer({ remainingMs }: { remainingMs: number }) {
  return (
    <span role="timer" aria-label="Time left in this lap" className={`timer${remainingMs < 0 ? ' over' : ''}`}>
      {remainingMs < 0 ? `+${fmtTimer(-remainingMs)}` : fmtTimer(remainingMs)}
    </span>
  );
}

function AutoEnd({ lap }: { lap: Lap }) {
  return (
    <label
      className="auto-end mono"
      title="Ticked: the lap stops by itself once its planned time has been timed. Unticked: it keeps recording until you stop it."
      onClick={(e) => e.stopPropagation()}
    >
      <input type="checkbox" className="checkbox" checked={lap.auto_end} onChange={() => setAutoEnd(store, lap, !lap.auto_end)} />
      AUTO-END
    </label>
  );
}

function HoursView({
  day,
  laps,
  ghosts,
  when,
  nowMs,
  activeId,
  onLog,
  onMove,
  onOpen,
}: {
  day: string;
  laps: Lap[];
  ghosts: (Ghost | CalGhost)[];
  when: string;
  nowMs: number;
  activeId: string | null;
  onLog: (l: Lap) => void;
  onMove: (l: Lap) => void;
  onOpen: (id: string) => void;
}) {
  const db = useDB();
  const scroller = useRef<HTMLDivElement>(null);
  const race = driverRace(db);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focus = when === 'today' ? minuteOfDay(nowMs) - 120 : laps.length ? minuteOfDay(lapPlacedStart(db, laps[0])!) - 60 : H0;
    el.scrollTop = Math.max(0, TOP(Math.max(H0, focus)));
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps
  const nowMin = minuteOfDay(nowMs);
  return (
    <div className="hours no-scrollbar" ref={scroller}>
      <div className="hours-inner" style={{ height: TOP(H1) + 20 }}>
        {Array.from({ length: (H1 - H0) / 60 + 1 }, (_, i) => (
          <div key={i} className="hours-line" style={{ top: i * HOUR }}>
            <span className="mono">{pad2(7 + i)}:00</span>
          </div>
        ))}
        {laps.map((l) => {
          const s = minuteOfDay(lapPlacedStart(db, l)!);
          const min = lapPlacedMin(db, l, nowMs);
          const isActive = l.id === activeId && when === 'today';
          const a = isActive ? activeLap(db, nowMs) : null;
          const done = lapIsDone(db, l, nowMs) && !isActive;
          const moved = l.status === 'moved';
          const canAct = when === 'today' && !done && !moved;
          const recM = recordedMin(db, l.id, nowMs);
          const pct = isActive ? Math.min(100, (recM / l.planned_min) * 100) : 0;
          const pill = done ? deltaPill(recM - l.planned_min) : null;
          return (
            <div
              key={l.id}
              className={`hb${done ? ' done' : ''}${isActive ? ' active' : ''}${moved ? ' moved' : ''}`}
              style={{ top: TOP(Math.max(H0, s)) + 2, height: Math.max(40, Math.round((min / 60) * HOUR) - 4), ['--pct' as string]: `${pct}%` }}
              data-chip="1"
            >
              <button className="hb-open" aria-label={`${l.title}. Show in the list`} onClick={() => onOpen(l.id)} />
              <div className="hb-text">
                <span className="mono hb-sub">{sub(db, l)}{moved ? ' · MOVED' : ''}</span>
                <span className="hb-title">{l.title}</span>
              </div>
              {canAct && (
                <span className="hb-actions" data-x="1">
                  {!isActive && (
                    <button className="btn btn-xs btn-solid" aria-label={`Log time for ${l.title}`} onClick={() => onLog(l)}>
                      LOG TIME
                    </button>
                  )}
                  <button className="btn btn-xs btn-solid" aria-label={`Move ${l.title} to later`} onClick={() => onMove(l)}>
                    MOVE TO LATER
                  </button>
                </span>
              )}
              {pill && <span className={`mono pill ${pill.cls} on-dark`}>{pill.text}</span>}
              {isActive && a && (
                <>
                  <AutoEnd lap={l} />
                  <Timer remainingMs={a.remainingMs} />
                </>
              )}
            </div>
          );
        })}
        {ghosts.map((g) => {
          const s = minuteOfDay(g.start);
          return (
            <div key={g.key} className="hb ghost" style={{ top: TOP(Math.max(H0, s)) + 2, height: Math.max(40, Math.round((g.min / 60) * HOUR) - 4) }}>
              <div className="hb-text">
                <span className="mono hb-sub">
                  {hhmm(g.start)}–{hhmm(addMinutes(g.start, g.min))} · {g.kind === 'calendar' ? g.source.toUpperCase() : 'REPEAT'}
                </span>
                <span className="hb-title">{g.title}</span>
              </div>
              {race && (when !== 'past' || g.kind === 'calendar') && (
                <span className="hb-ghost-actions">
                  <button
                    className="btn btn-sm btn-solid"
                    aria-label={`Add ${g.title}`}
                    onClick={() => {
                      const id = g.kind === 'repeat' ? keepGhost(store, race, g, 'home') : addCalendarEvent(store, race, g, 'home');
                      showToast(`Added ${g.title}`, id);
                    }}
                  >
                    <IconPlus size={10} /> ADD
                  </button>
                  <button
                    className="round-btn big"
                    aria-label={`Dismiss ${g.title}`}
                    onClick={() => {
                      const id = g.kind === 'repeat' ? skipGhost(store, race, g, 'home') : dismissCalendarEvent(store, race, g, 'home');
                      showToast(`${g.kind === 'repeat' ? 'Skipped' : 'Dismissed'} ${g.title}`, id);
                    }}
                  >
                    <IconX size={10} />
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {when === 'today' && nowMin >= H0 && nowMin <= H1 && (
          <div className="hours-now" style={{ top: TOP(nowMin) }} aria-hidden="true">
            <span />
          </div>
        )}
      </div>
    </div>
  );
}

function ListView({
  laps,
  ghosts,
  when,
  nowMs,
  open,
  setOpen,
  onLog,
  onEditTime,
  onMove,
}: {
  laps: Lap[];
  ghosts: (Ghost | CalGhost)[];
  when: string;
  nowMs: number;
  open: string | null;
  setOpen: (id: string | null) => void;
  onLog: (l: Lap) => void;
  onEditTime: (l: Lap, t: LapTime) => void;
  onMove: (l: Lap) => void;
}) {
  const db = useDB();
  const act = activeLap(db, nowMs);
  const rowRef = useRef<HTMLLIElement>(null);
  useEffect(() => rowRef.current?.scrollIntoView({ block: 'nearest' }), [open]);
  const items = [
    ...laps.map((l) => ({ kind: 'lap' as const, at: lapPlacedStart(db, l)!.getTime(), l })),
    ...ghosts.map((g) => ({ kind: 'ghost' as const, at: g.start.getTime(), g })),
  ].sort((a, b) => a.at - b.at);
  return (
    <div className="list no-scrollbar">
      <ul>
        {items.map((it) => {
          if (it.kind === 'ghost') {
            const g = it.g;
            return (
              <li key={g.key} className="lr ghost">
                <div className="lr-row">
                  <span className="lr-circle ghost" />
                  <span className="lr-main">
                    <span className="mono lr-sub">
                      {hhmm(g.start)}–{hhmm(addMinutes(g.start, g.min))}
                    </span>
                    <span className="lr-title">{g.title}</span>
                  </span>
                  <span className="mono chip-state">{g.kind === 'calendar' ? 'CALENDAR EVENT' : 'REPEAT · NOT KEPT'}</span>
                </div>
              </li>
            );
          }
          const l = it.l;
          const isActive = act?.lap.id === l.id && when === 'today';
          const done = lapIsDone(db, l, nowMs) && !isActive;
          const moved = l.status === 'moved';
          const recM = recordedMin(db, l.id, nowMs);
          const times = timesOf(db, l.id);
          const isOpen = open === l.id || isActive;
          const state = moved ? 'MOVED' : done ? 'COMPLETE' : isActive ? (act!.running ? 'ON TRACK' : 'PAUSED') : recM > 0 ? 'IN PROGRESS' : 'NOT STARTED';
          const pill = done ? deltaPill(recM - l.planned_min) : null;
          const pct = isActive ? Math.min(100, (recM / l.planned_min) * 100) : 0;
          const g = goalOf(db, l.goal_id);
          return (
            <li key={l.id} ref={open === l.id ? rowRef : undefined} className={`lr${isActive ? ' active' : ''}${done ? ' done' : ''}${moved ? ' moved' : ''}`} style={{ ['--pct' as string]: `${pct}%` }}>
              <button className="lr-row" aria-expanded={isOpen} onClick={() => setOpen(open === l.id ? null : l.id)}>
                <span className={`lr-circle${done ? ' done' : ''}`} style={{ ['--c' as string]: g?.color ?? '#8F8F97' }}>
                  {done && <IconCheck size={10} />}
                </span>
                <span className="lr-main">
                  <span className="mono lr-sub">{sub(db, l)}</span>
                  <span className="lr-title">{l.title}</span>
                </span>
                {isActive ? (
                  <span className="lr-timer">
                    <Timer remainingMs={act!.remainingMs} />
                    <span className="mono lr-leftof">
                      {act!.remainingMs > 0
                        ? `LEFT OF ${l.planned_min}:00`
                        : act!.autoEnded
                          ? `AUTO-ENDED AT ${l.planned_min}:00`
                          : `OVER ${l.planned_min}:00 · STILL RECORDING`}
                    </span>
                  </span>
                ) : (
                  <span className="lr-time">
                    <span className="mono">
                      {fmtDur(recM)} / {fmtDur(l.planned_min)}
                    </span>
                    {pill && <span className={`mono pill ${pill.cls}`}>{pill.text}</span>}
                  </span>
                )}
                <span className={`mono chip-state${done ? ' done' : ''}`}>{state}</span>
              </button>
              {isActive && act && (
                <div className="lr-controls">
                  <AutoEnd lap={l} />
                  <button
                    className="btn btn-sm btn-red"
                    onClick={() => (act.autoEnded ? keepGoing(store, l) : act.running ? pauseRunning(store) : startLap(store, l))}
                  >
                    {act.autoEnded ? 'KEEP GOING' : act.running ? 'PAUSE' : 'RESUME'}
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => onMove(l)}>
                    MOVE TO LATER
                  </button>
                </div>
              )}
              {isOpen && (
                <div className="lr-body">
                  {when === 'today' && !isActive && !done && !moved && (
                    <div className="lr-controls">
                      <button className="btn btn-sm btn-red" onClick={() => startLap(store, l)}>
                        START LAP
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => onLog(l)}>
                        LOG TIME
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => onMove(l)}>
                        MOVE TO LATER
                      </button>
                    </div>
                  )}
                  {l.description && <p className="lr-desc">{l.description}</p>}
                  <div className="lr-times">
                    <span className="label">TIME RECORDED</span>
                    {!times.length && <span className="muted small">Nothing recorded yet.</span>}
                    {times.map((t) => (
                      <div key={t.id} className="lr-time-row" data-chip="1">
                        <span className="mono">
                          {hhmm(t.started_at)}–{t.ended_at ? hhmm(t.ended_at) : 'now'} · {fmtDur((new Date(t.ended_at ?? nowMs).getTime() - new Date(t.started_at).getTime()) / MIN)}
                          {t.how === 'by_hand' ? ' · BY HAND' : ''}
                        </span>
                        {when === 'today' && t.ended_at && (
                          <button className="btn btn-xs btn-soft lr-time-edit" data-x="1" aria-label={`Edit or remove this time`} onClick={() => onEditTime(l, t)}>
                            <IconEdit size={10} /> EDIT
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {when === 'past' && <p className="muted small">Past days are read-only.</p>}
                  {when === 'future' && !moved && (
                    <p className="muted small">
                      Comes up on {fromDayKey(dayKey(lapPlacedStart(db, l)!)).toLocaleDateString('en-GB', { weekday: 'long' })}. You can move it to another day in Race week’s Mechanics mode.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { lapIsRunning };
