import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDB } from '../../data/store';
import type { Lap } from '../../data/types';
import type { Ghost } from '../../domain/repeats';
import { lapColor, lapIsRunning, lapPlacedMin, lapPlacedStart, recordedMs, timesOf, goalOf } from '../../domain/selectors';
import { DAY_SHORT, MIN, addMinutes, atTime, dayKey, fromDayKey, hhmm, minuteOfDay, pad2, snap, startOfDay } from '../../lib/time';
import { IconPlus, IconX } from '../../ui/icons';

export const HOUR = 48;
export const H0 = 7 * 60; // 07:00
export const H1 = 23 * 60; // 23:00
const TOP = (m: number) => Math.round(((m - H0) / 60) * HOUR);
const HEIGHT = (min: number) => Math.max(20, Math.round((min / 60) * HOUR) - 2);
const yToMin = (y: number) => H0 + (y / HOUR) * 60;

export type GridMode = 'driver' | 'mech' | 'session';

export interface CalGhost {
  key: string;
  kind: 'calendar';
  title: string;
  start: Date;
  min: number;
  source: string;
}

interface Props {
  days: Date[];
  mode: GridMode;
  laps: Lap[];
  ghosts: (Ghost | CalGhost)[];
  raceTag: { day: string; label: string } | null;
  sessionAt: Date | null;
  sessionDraggable: boolean;
  nowMs: number;
  lockedBefore: number;
  selectedId: string | null;
  dayWidth: number | null; // null = fill
  trayDrag: Lap | null;
  onSelect: (id: string | null) => void;
  onCreate: (day: string, startMin: number, endMin: number | null) => void;
  onMove: (lap: Lap, start: Date, min: number) => void;
  onDropTray: (lap: Lap, start: Date) => void;
  onTrayDragEnd: () => void;
  onRecord: (lap: Lap) => void;
  onKeep: (g: Ghost | CalGhost) => void;
  onSkip: (g: Ghost | CalGhost) => void;
  onSessionDrag: (to: Date) => void;
  onEdge?: (side: 'left' | 'right') => void;
  scrollKey?: number;
}

type Drag =
  | { kind: 'lap'; lap: Lap; mode: 'move' | 'top' | 'bottom'; x0: number; y0: number; origStart: Date; origMin: number; day: string; startMin: number; min: number; moved: boolean }
  | { kind: 'create'; day: string; a: number; b: number }
  | { kind: 'session'; x0: number; y0: number; origMin: number; day: string; startMin: number; moved: boolean }
  | { kind: 'tray'; lap: Lap; day: string | null; startMin: number };

export function WeekGrid(p: Props) {
  const db = useDB();
  const scroller = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const editable = p.mode !== 'driver';
  const todayKey = dayKey(p.nowMs);

  // Start scrolled to a little before now (or 08:00).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Today in view: start a little before now. Otherwise (a future race) start at 07:45.
    const todayShown = p.days.some((d) => dayKey(d) === todayKey);
    const m = todayShown ? minuteOfDay(p.nowMs) : 0;
    el.scrollTop = Math.max(0, TOP(Math.min(H1 - 6 * 60, Math.max(H0 + 45, m - 90))));
    if (p.dayWidth) {
      const i = p.days.findIndex((d) => dayKey(d) === todayKey);
      if (i >= 0) el.scrollLeft = Math.max(0, i * p.dayWidth - p.dayWidth * 2);
    }
  }, [p.scrollKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where the pointer is: which day column and minute.
  const locate = (e: { clientX: number; clientY: number }) => {
    const body = bodyRef.current!;
    const r = body.getBoundingClientRect();
    const colW = r.width / p.days.length;
    const i = Math.max(0, Math.min(p.days.length - 1, Math.floor((e.clientX - r.left) / colW)));
    const min = yToMin(e.clientY - r.top);
    return { day: dayKey(p.days[i]), min };
  };
  const minStart = (day: string) => {
    const lock = p.lockedBefore;
    const dayStart = fromDayKey(day).getTime();
    if (lock <= dayStart) return 0;
    if (lock >= dayStart + 24 * 60 * MIN) return 24 * 60 + 1;
    return snap(Math.ceil((lock - dayStart) / MIN / 15) * 15, 15);
  };

  // Tray drag comes from the side panel; follow the pointer over the grid.
  useEffect(() => {
    if (!p.trayDrag) return;
    const lap = p.trayDrag;
    setDrag({ kind: 'tray', lap, day: null, startMin: 0 });
    const move = (e: PointerEvent) => {
      const r = bodyRef.current?.getBoundingClientRect();
      if (!r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        setDrag({ kind: 'tray', lap, day: null, startMin: 0 });
        return;
      }
      const { day, min } = locate(e);
      const s = Math.max(minStart(day), snap(min - lap.planned_min / 2, 15));
      setDrag({ kind: 'tray', lap, day, startMin: Math.min(s, H1 - 15) });
    };
    const up = () => {
      setDrag((d) => {
        if (d?.kind === 'tray' && d.day && d.startMin <= H1 - 15) p.onDropTray(d.lap, atTime(d.day, `${pad2(Math.floor(d.startMin / 60))}:${pad2(d.startMin % 60)}`));
        return null;
      });
      p.onTrayDragEnd();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [p.trayDrag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lap / create / session drags.
  useEffect(() => {
    if (!drag || drag.kind === 'tray') return;
    const move = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d;
        if (d.kind === 'create') return { ...d, b: locate(e).min };
        if (d.kind === 'lap') {
          const dm = snap(((e.clientY - d.y0) / HOUR) * 60, 15);
          const moved = d.moved || Math.abs(e.clientY - d.y0) > 4 || Math.abs(e.clientX - d.x0) > 4;
          const origStartMin = minuteOfDay(d.origStart);
          if (d.mode === 'move') {
            const { day } = locate(e);
            let s = snap(origStartMin + dm, 15);
            s = Math.max(s, minStart(day), H0 - 60);
            s = Math.min(s, H1 - 15);
            return { ...d, day, startMin: s, moved };
          }
          if (d.mode === 'top') {
            const end = origStartMin + d.origMin;
            const s = Math.max(minStart(d.day), Math.min(end - 15, snap(origStartMin + dm, 15)));
            return { ...d, startMin: s, min: end - s, moved };
          }
          const m = Math.max(15, snap(d.origMin + dm, 15));
          return { ...d, min: Math.min(m, H1 - origStartMin), moved };
        }
        if (d.kind === 'session') {
          const { day } = locate(e);
          const dm = snap(((e.clientY - d.y0) / HOUR) * 60, 15);
          return { ...d, day, startMin: Math.max(H0, Math.min(H1 - 15, d.origMin + dm)), moved: d.moved || Math.abs(e.clientY - d.y0) > 4 || Math.abs(e.clientX - d.x0) > 4 };
        }
        return d;
      });
    };
    const up = () => {
      setDrag((d) => {
        if (!d) return null;
        if (d.kind === 'create') {
          const a = Math.min(d.a, d.b);
          const b = Math.max(d.a, d.b);
          const s = Math.max(snap(a, 15), minStart(d.day));
          if (b - a < 15) p.onCreate(d.day, Math.max(s, snap(a - 7, 15)), null);
          else p.onCreate(d.day, s, Math.max(s + 15, snap(b, 15)));
        } else if (d.kind === 'lap') {
          // A plain click selects through the block's button; only real drags move.
          if (d.moved) p.onMove(d.lap, atTime(d.day, `${pad2(Math.floor(d.startMin / 60))}:${pad2(d.startMin % 60)}`), d.min);
        } else if (d.kind === 'session' && d.moved) {
          p.onSessionDrag(atTime(d.day, `${pad2(Math.floor(d.startMin / 60))}:${pad2(d.startMin % 60)}`));
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const canDrag = (lap: Lap) =>
    editable &&
    lap.status === 'planned' &&
    !timesOf(db, lap.id).length &&
    (!lap.planned_start || new Date(lap.planned_start).getTime() >= p.lockedBefore);

  const onBodyDown = (e: React.PointerEvent, day: string) => {
    if (!editable || e.button !== 0) return;
    if (!(e.target as HTMLElement).dataset.slot) return;
    const { min } = locate(e);
    if (min < minStart(day)) return;
    setDrag({ kind: 'create', day, a: min, b: min });
    e.preventDefault();
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !p.onEdge || !p.dayWidth) return;
    if (el.scrollLeft < p.dayWidth * 2) p.onEdge('left');
    else if (el.scrollLeft + el.clientWidth > el.scrollWidth - p.dayWidth * 2) p.onEdge('right');
  };
  // Keep the view still when days are added on the left.
  const firstDay = useRef(dayKey(p.days[0]));
  const lastScrollKey = useRef(p.scrollKey);
  useLayoutEffect(() => {
    const el = scroller.current;
    const k = dayKey(p.days[0]);
    // A view switch (THIS RACE ⇄ SCROLL DAYS, or 📅) re-centres on today instead.
    const switched = lastScrollKey.current !== p.scrollKey;
    lastScrollKey.current = p.scrollKey;
    if (el && p.dayWidth && !switched && k !== firstDay.current) {
      const added = Math.round((fromDayKey(firstDay.current).getTime() - fromDayKey(k).getTime()) / (24 * 3600_000));
      if (added > 0) el.scrollLeft += added * p.dayWidth;
    }
    firstDay.current = k;
  }, [p.days, p.dayWidth]);

  const colStyle = p.dayWidth ? { width: p.dayWidth, flex: 'none' } : undefined;
  const totalH = TOP(H1);

  return (
    <section className="wg glass" aria-label="Week of hours">
      <div className="wg-scroll no-scrollbar" ref={scroller} onScroll={onScroll}>
        <div className="wg-inner" style={p.dayWidth ? { width: 64 + p.dayWidth * p.days.length } : undefined}>
          <div className="wg-head">
            <div className="wg-corner" />
            {p.days.map((d) => {
              const k = dayKey(d);
              return (
                <div key={k} className="wg-dayhead" style={colStyle}>
                  {p.raceTag?.day === k && <span className="wg-racetag mono">{p.raceTag.label}</span>}
                  <span className="wg-wd mono">
                    {DAY_SHORT[d.getDay()]}
                    <span className={k === todayKey ? 'wg-today-num' : 'wg-num'}>{d.getDate()}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="wg-body-row">
            <div className="wg-hours" style={{ height: totalH }}>
              {Array.from({ length: (H1 - H0) / 60 + 1 }, (_, i) => (
                <span key={i} className="mono wg-hour" style={{ top: i * HOUR }}>
                  {pad2(7 + i)}:00
                </span>
              ))}
            </div>
            <div className="wg-days" ref={bodyRef} style={{ height: totalH }}>
              {p.days.map((d) => (
                <DayColumn key={dayKey(d)} {...p} day={d} drag={drag} setDrag={setDrag} canDrag={canDrag} onBodyDown={onBodyDown} colStyle={colStyle} minStart={minStart} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function lanes(items: { id: string; a: number; b: number }[]) {
  const sorted = [...items].sort((x, y) => x.a - y.a || y.b - x.b);
  const lane = new Map<string, { i: number; n: number }>();
  let group: typeof sorted = [];
  let groupEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    const assigned: [string, number][] = [];
    for (const it of group) {
      let i = ends.findIndex((e) => e <= it.a);
      if (i < 0) i = ends.length;
      ends[i] = it.b;
      assigned.push([it.id, i]);
    }
    for (const [id, i] of assigned) lane.set(id, { i, n: ends.length });
    group = [];
  };
  for (const it of sorted) {
    if (group.length && it.a >= groupEnd) flush();
    group.push(it);
    groupEnd = Math.max(groupEnd, it.b);
    if (group.length === 1) groupEnd = it.b;
  }
  if (group.length) flush();
  return lane;
}

function DayColumn(
  p: Props & {
    day: Date;
    drag: Drag | null;
    setDrag: (d: Drag | null) => void;
    canDrag: (l: Lap) => boolean;
    onBodyDown: (e: React.PointerEvent, day: string) => void;
    colStyle: React.CSSProperties | undefined;
    minStart: (day: string) => number;
  },
) {
  const db = useDB();
  const k = dayKey(p.day);
  const todayKey = dayKey(p.nowMs);
  const dayStart = startOfDay(p.day).getTime();
  const dayEnd = dayStart + 24 * 60 * MIN;

  const lapsHere = p.laps.filter((l) => {
    if (l.status === 'dropped') return false;
    const s = lapPlacedStart(db, l);
    if (!s) return false;
    const dragging = p.drag?.kind === 'lap' && p.drag.lap.id === l.id;
    return dragging ? false : dayKey(s) === k;
  });
  const ghostsHere = p.ghosts.filter((g) => dayKey(g.start) === k);
  const items = [
    ...lapsHere.map((l) => {
      const s = minuteOfDay(lapPlacedStart(db, l)!);
      return { id: l.id, a: s, b: s + lapPlacedMin(db, l, p.nowMs) };
    }),
    ...ghostsHere.map((g) => ({ id: g.key, a: minuteOfDay(g.start), b: minuteOfDay(g.start) + g.min })),
  ];
  const laneOf = lanes(items);
  const laneStyle = (id: string): React.CSSProperties => {
    const l = laneOf.get(id) ?? { i: 0, n: 1 };
    const w = 100 / l.n;
    return { left: `calc(${l.i * w}% + 2px)`, width: `calc(${w}% - 4px)` };
  };

  // Blackout (Mechanics mode): past days and the hours already gone today.
  let shadeH = 0;
  if (p.mode === 'mech') {
    if (p.lockedBefore >= dayEnd) shadeH = TOP(H1);
    else if (p.lockedBefore > dayStart) shadeH = Math.max(0, TOP(p.minStart(k)));
  }
  const sessionHere = p.sessionAt && dayKey(p.sessionAt) === k;
  const sessionDragHere = p.drag?.kind === 'session' && p.drag.moved && p.drag.day === k;
  const nowHere = k === todayKey;
  const nowMin = minuteOfDay(p.nowMs);

  return (
    <div className={`wg-day${k === todayKey ? ' today' : ''}`} style={p.colStyle} data-slot="1" onPointerDown={(e) => p.onBodyDown(e, k)}>
      {Array.from({ length: (H1 - H0) / 60 }, (_, i) => (
        <div key={i} className="wg-line" style={{ top: i * HOUR }} data-slot="1" />
      ))}
      {shadeH > 0 && <div className="wg-shade" style={{ height: shadeH }} aria-hidden="true" />}
      {lapsHere.map((l) => (
        <Block key={l.id} {...p} lap={l} style={laneStyle(l.id)} />
      ))}
      {ghostsHere.map((g) => {
        const s = minuteOfDay(g.start);
        const goal = g.kind === 'repeat' ? goalOf(db, g.goal_id) : undefined;
        const canAct = p.mode !== 'driver' || g.start.getTime() > p.nowMs - 60 * MIN || g.kind === 'calendar';
        return (
          <div
            key={g.key}
            className={`wg-block ghost ${g.kind}`}
            style={{ ...laneStyle(g.key), top: TOP(s), height: HEIGHT(g.min), ['--c' as string]: goal?.color ?? '#8F8F97' }}
            title={`${g.title} · ${hhmm(g.start)}–${hhmm(addMinutes(g.start, g.min))}${g.kind === 'calendar' ? ` · ${g.source}` : ' · repeat'}`}
          >
            <span className="wg-title">{g.title}</span>
            <span className="wg-time mono">{hhmm(g.start)}</span>
            {canAct && (
              <span className="wg-ghost-actions">
                <button className="round-btn solid" aria-label={`Keep ${g.title} on ${DAY_SHORT[g.start.getDay()]}`} onClick={() => p.onKeep(g)}>
                  <IconPlus size={9} />
                </button>
                <button className="round-btn" aria-label={`Skip ${g.title} on ${DAY_SHORT[g.start.getDay()]}`} onClick={() => p.onSkip(g)}>
                  <IconX size={8} />
                </button>
              </span>
            )}
          </div>
        );
      })}
      {(sessionHere || sessionDragHere) && (
        <SessionBlock {...p} k={k} />
      )}
      {p.drag?.kind === 'lap' && p.drag.day === k && (
        <div className="wg-block preview" style={{ left: 2, right: 2, top: TOP(p.drag.startMin), height: HEIGHT(p.drag.min), ['--c' as string]: lapColor(db, p.drag.lap) }}>
          <span className="wg-title">{p.drag.lap.title}</span>
          <span className="wg-time mono">
            {pad2(Math.floor(p.drag.startMin / 60))}:{pad2(p.drag.startMin % 60)}
          </span>
        </div>
      )}
      {p.drag?.kind === 'tray' && p.drag.day === k && (
        <div className="wg-block preview" style={{ left: 2, right: 2, top: TOP(p.drag.startMin), height: HEIGHT(p.drag.lap.planned_min), ['--c' as string]: lapColor(db, p.drag.lap) }}>
          <span className="wg-title">{p.drag.lap.title}</span>
          <span className="wg-time mono">
            {pad2(Math.floor(p.drag.startMin / 60))}:{pad2(p.drag.startMin % 60)}
          </span>
        </div>
      )}
      {p.drag?.kind === 'create' && p.drag.day === k && Math.abs(p.drag.b - p.drag.a) >= 10 && (
        <div className="wg-create mono" style={{ top: TOP(snap(Math.min(p.drag.a, p.drag.b), 15)), height: HEIGHT(snap(Math.abs(p.drag.b - p.drag.a), 15)) }}>
          NEW LAP
        </div>
      )}
      {nowHere && nowMin >= H0 && nowMin <= H1 && (
        <div className="wg-now" style={{ top: TOP(nowMin) }} aria-hidden="true">
          <span />
        </div>
      )}
    </div>
  );
}

function SessionBlock(p: Props & { k: string; drag: Drag | null; setDrag: (d: Drag | null) => void }) {
  const dragging = p.drag?.kind === 'session' && p.drag.moved ? p.drag : null;
  const at = dragging ? null : p.sessionAt!;
  const startMin = dragging ? dragging.startMin : minuteOfDay(at!);
  if (dragging && dragging.day !== p.k) return null;
  if (!dragging && p.drag?.kind === 'session' && p.drag.moved) return null;
  const top = TOP(Math.max(H0, startMin));
  return (
    <div
      className={`wg-session${p.sessionDraggable ? ' draggable' : ''}${dragging ? ' dragging' : ''}`}
      style={{ top, height: Math.max(40, TOP(H1) - top) }}
      title={p.sessionDraggable ? 'Drag earlier to bring the Mechanics session forward' : 'Mechanics session'}
      onPointerDown={(e) => {
        if (!p.sessionDraggable || e.button !== 0) return;
        e.stopPropagation();
        p.setDrag({ kind: 'session', x0: e.clientX, y0: e.clientY, origMin: startMin, day: p.k, startMin, moved: false });
      }}
    >
      <span className="wg-session-flag" aria-hidden="true" />
      <span className="wg-title">Mechanics session</span>
      <span className="wg-time mono">
        {pad2(Math.floor(startMin / 60))}:{pad2(startMin % 60)}
      </span>
    </div>
  );
}

function Block(
  p: Props & { lap: Lap; style: React.CSSProperties; setDrag: (d: Drag | null) => void; canDrag: (l: Lap) => boolean },
) {
  const db = useDB();
  const lap = p.lap;
  const start = lapPlacedStart(db, lap)!;
  const min = lapPlacedMin(db, lap, p.nowMs);
  const s = minuteOfDay(start);
  const rec = recordedMs(db, lap.id, p.nowMs);
  const running = lapIsRunning(db, lap);
  const done = lap.status === 'done' || (rec >= lap.planned_min * MIN && !running);
  const moved = lap.status === 'moved';
  const ended = start.getTime() + lap.planned_min * MIN < p.nowMs;
  // Only while that lap's race is live: fixing a record after the race is a future feature (brief §10).
  const raceLive = db.races.find((r) => r.id === lap.race_id)?.status === 'live';
  const needsRecord = p.mode === 'driver' && raceLive && lap.status === 'planned' && !rec && !running && ended;
  const draggable = p.canDrag(lap);
  const colour = lapColor(db, lap);
  const black = colour.toUpperCase() === '#111111';
  const cls = ['wg-block', done ? 'done' : rec > 0 ? 'partial' : 'planned', moved ? 'moved' : '', running ? 'running' : '', p.selectedId === lap.id ? 'selected' : '', draggable ? 'draggable' : '', black ? 'black' : '']
    .filter(Boolean)
    .join(' ');
  const h = HEIGHT(min);
  const down = (mode: 'move' | 'top' | 'bottom') => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (!draggable) return;
    e.preventDefault();
    p.setDrag({ kind: 'lap', lap, mode, x0: e.clientX, y0: e.clientY, origStart: start, origMin: lap.planned_min, day: dayKey(start), startMin: s, min: lap.planned_min, moved: false });
  };
  return (
    <div
      className={cls}
      style={{ ...p.style, top: TOP(Math.max(H0, s)), height: h, ['--c' as string]: colour }}
      onPointerDown={down('move')}
    >
      <button
        className="wg-select"
        aria-label={`${lap.title}, ${hhmm(start)}${moved ? ', moved' : done ? ', done' : ''}. Show details.`}
        onClick={() => p.onSelect(p.selectedId === lap.id ? null : lap.id)}
      />
      {needsRecord && (
        <input
          type="checkbox"
          className="checkbox wg-check"
          checked={false}
          aria-label={`Record ${lap.title} by hand`}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={() => p.onRecord(lap)}
        />
      )}
      <span className={`wg-title${h > 36 ? ' wrap' : ''}`}>{lap.title}</span>
      <span className="wg-time mono">{hhmm(start)}</span>
      {draggable && (
        <>
          <span className="wg-resize top" onPointerDown={down('top')} />
          <span className="wg-resize bottom" onPointerDown={down('bottom')} />
        </>
      )}
    </div>
  );
}
