import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { store, useDB } from '../../data/store';
import type { Goal, Subgoal } from '../../data/types';
import { updateSubgoal } from '../../domain/goals';
import { driverRace, raceWeekStart, racesSorted } from '../../domain/selectors';
import { DAY, MONTH_SHORT, addDays, dayKey, fmtDateShort, fmtDateSmart, fromDayKey, fmtDur, now, pad2, startOfDay, startOfWeek } from '../../lib/time';
import { Flag, IconChevron, IconDoubleChevron, IconFilter } from '../../ui/icons';
import { showToast } from '../../ui/signals';
import { todaySignal } from '../../shell/Shell';

export type Zoom = 'week' | 'month' | 'quarter' | 'year';
export const ZOOM_PX: Record<Zoom, number> = { week: 12, month: 4, quarter: 1.6, year: 0.7 };
const CHUNK_DAYS: Record<Zoom, number> = { week: 182, month: 365, quarter: 730, year: 3650 };

const HEAD = 58;
const ROW = 56;
const SUBH = 20;
const NAMES_W = 238;
const NAMES_FOLDED = 56;

interface Props {
  goals: Goal[];
  zoom: Zoom;
  canEdit: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  folded: boolean;
  onFold: () => void;
  hidden: Record<string, boolean>;
  onToggleSubs: (id: string) => void;
  filter: { hideAchieved: boolean; hideArchived: boolean };
  onFilter: (f: { hideAchieved: boolean; hideArchived: boolean }) => void;
  counts: { achieved: number; archived: number };
  onColour: (goal: Goal, el: HTMLElement) => void;
  onReorder: (ids: string[]) => void;
  onNewGoal: (start: string, due: string) => void;
  onNewSub: (goal: Goal, start: string, due: string) => void;
  onEditSub: (sub: Subgoal) => void;
  onToggleSub: (sub: Subgoal) => void;
  onExtend: (goal: Goal, to: string) => void;
}

type Drag =
  | { kind: 'create'; goalId: string | null; x0: number; x1: number; top: number; h: number }
  | { kind: 'sub'; sub: Subgoal; mode: 'move' | 'start' | 'end'; px0: number; dx: number; moved: boolean }
  | { kind: 'extend'; goal: Goal; px0: number; dx: number }
  | { kind: 'reorder'; id: string; py0: number; dy: number; moved: boolean };

export function Timeline(p: Props) {
  const db = useDB();
  const scroller = useRef<HTMLDivElement>(null);
  const today = startOfDay(now());
  const px = ZOOM_PX[p.zoom];

  // Endless range: grows by a chunk when you scroll near either edge.
  const baseRange = useMemo(() => {
    const starts = p.goals.map((g) => fromDayKey(g.start_date).getTime());
    const ends = p.goals.map((g) => fromDayKey(g.due_date).getTime());
    const lo = Math.min(today.getTime(), ...starts);
    const hi = Math.max(today.getTime(), ...ends);
    return { lo, hi };
  }, [p.goals, today.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ext, setExt] = useState({ before: 1, after: 1 });
  useEffect(() => setExt({ before: 1, after: 1 }), [p.zoom]);
  const t0 = useMemo(() => alignStart(new Date(baseRange.lo - CHUNK_DAYS[p.zoom] * ext.before * DAY * 0.5), p.zoom), [baseRange.lo, p.zoom, ext.before]);
  const t1 = useMemo(() => new Date(baseRange.hi + CHUNK_DAYS[p.zoom] * ext.after * DAY * 0.6), [baseRange.hi, p.zoom, ext.after]);
  const dx = (d: Date | string) => Math.round(((typeof d === 'string' ? fromDayKey(d) : d).getTime() - t0.getTime()) / DAY * px);
  const trackW = dx(t1);
  const dateAt = (x: number) => dayKey(addDays(t0, Math.round(x / px)));
  const pendingShift = useRef(0);

  // Keep the view still when the range grows on the left.
  const prevT0 = useRef(t0.getTime());
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const shift = Math.round(((prevT0.current - t0.getTime()) / DAY) * px);
    if (shift > 0 && pendingShift.current) el.scrollLeft += shift;
    pendingShift.current = 0;
    prevT0.current = t0.getTime();
  }, [t0, px]);

  const scrollToToday = () => {
    const el = scroller.current;
    if (!el) return;
    const namesW = p.folded ? NAMES_FOLDED : NAMES_W;
    el.scrollLeft = Math.max(0, dx(today) - (el.clientWidth - namesW) / 3);
  };
  useLayoutEffect(scrollToToday, [p.zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayTick = todaySignal.use();
  useEffect(() => {
    if (todayTick) scrollToToday();
  }, [todayTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the detail panel opens or closes, keep the centre of the view on the same date.
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w !== lastW) el.scrollLeft += (lastW - w) / 2;
      lastW = w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    if (el.scrollLeft < 300) {
      pendingShift.current = 1;
      setExt((e) => ({ ...e, before: e.before + 1 }));
    } else if (el.scrollLeft + el.clientWidth > el.scrollWidth - 300) setExt((e) => ({ ...e, after: e.after + 1 }));
  };

  // Periods for the header.
  const periods = useMemo(() => buildPeriods(t0, t1, p.zoom, db), [t0, t1, p.zoom, db]);

  // Rows layout.
  const [drag, setDrag] = useState<Drag | null>(null);
  const subsOf = (g: Goal) =>
    db.subgoals.filter((s) => s.goal_id === g.id).sort((a, b) => a.start_date.localeCompare(b.start_date) || a.created_at.localeCompare(b.created_at));
  const layout = useMemo(() => {
    let top = 0;
    return p.goals.map((g) => {
      const subs = g.status === 'active' ? subsOf(g) : [];
      const show = g.status === 'active' && !p.hidden[g.id];
      const h = ROW + (show ? subs.length * SUBH : 0) + (show && subs.length ? 8 : 0);
      const row = { g, subs, show, top, h };
      top += h;
      return row;
    });
  }, [p.goals, p.hidden, db.subgoals]); // eslint-disable-line react-hooks/exhaustive-deps
  const bodyH = layout.reduce((s, r) => s + r.h, 0);
  const namesW = p.folded ? NAMES_FOLDED : NAMES_W;

  // Reorder: the dragged row follows the cursor; others make room.
  const reorder = drag?.kind === 'reorder' ? drag : null;
  const reorderIndex = (() => {
    if (!reorder) return -1;
    const from = layout.findIndex((r) => r.g.id === reorder.id);
    const center = layout[from].top + layout[from].h / 2 + reorder.dy;
    let idx = layout.findIndex((r) => center < r.top + r.h / 2);
    if (idx < 0) idx = layout.length - 1;
    return idx;
  })();
  const shiftFor = (i: number) => {
    if (!reorder) return 0;
    const from = layout.findIndex((r) => r.g.id === reorder.id);
    if (i === from) return reorder.dy;
    const h = layout[from].h;
    if (from < reorderIndex && i > from && i <= reorderIndex) return -h;
    if (from > reorderIndex && i < from && i >= reorderIndex) return h;
    return 0;
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d;
        if (d.kind === 'create') return { ...d, x1: trackX(e) };
        if (d.kind === 'sub') {
          const delta = Math.round((e.clientX - d.px0) / px) * px;
          return { ...d, dx: delta, moved: d.moved || Math.abs(e.clientX - d.px0) > 3 };
        }
        if (d.kind === 'extend') return { ...d, dx: Math.max(0, Math.round((e.clientX - d.px0) / px) * px) };
        if (d.kind === 'reorder') return { ...d, dy: e.clientY - d.py0, moved: d.moved || Math.abs(e.clientY - d.py0) > 4 };
        return d;
      });
    };
    const up = () => {
      setDrag((d) => {
        if (!d) return null;
        finish(d);
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [!!drag]); // eslint-disable-line react-hooks/exhaustive-deps

  const trackRef = useRef<HTMLDivElement>(null);
  const trackX = (e: { clientX: number }) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(trackW, e.clientX - r.left));
  };

  const finish = (d: Drag) => {
    if (d.kind === 'create') {
      const a = Math.min(d.x0, d.x1);
      const b = Math.max(d.x0, d.x1);
      if (b - a < px * 2) return;
      const s = dateAt(a);
      const e = dateAt(b);
      const goal = d.goalId ? p.goals.find((g) => g.id === d.goalId) : null;
      if (goal) p.onNewSub(goal, s, e);
      else p.onNewGoal(s, e);
    } else if (d.kind === 'sub') {
      if (!d.moved) {
        p.onEditSub(d.sub);
        return;
      }
      const days = Math.round(d.dx / px);
      if (!days) return;
      let s = d.sub.start_date;
      let e = d.sub.due_date;
      if (d.mode !== 'end') s = dayKey(addDays(fromDayKey(s), days));
      if (d.mode !== 'start') e = dayKey(addDays(fromDayKey(e), days));
      if (e <= s) return showToast('A subgoal needs at least a day.');
      const id = updateSubgoal(store, d.sub, { start_date: s, due_date: e }, `Moved subgoal “${d.sub.title}”`);
      showToast(`${d.sub.title} · ${fmtDateShort(s)} → ${fmtDateShort(e)}`, id);
    } else if (d.kind === 'extend') {
      const days = Math.round(d.dx / px);
      if (days > 0) p.onExtend(d.goal, dayKey(addDays(fromDayKey(d.goal.due_date), days)));
    } else if (d.kind === 'reorder') {
      if (!d.moved) {
        p.onSelect(p.selected === d.id ? null : d.id);
        return;
      }
      const ids = p.goals.map((g) => g.id);
      const from = ids.indexOf(d.id);
      ids.splice(from, 1);
      ids.splice(reorderIndexRef.current, 0, d.id);
      p.onReorder(ids);
    }
  };
  const reorderIndexRef = useRef(-1);
  reorderIndexRef.current = reorderIndex;

  const onTrackDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (!t.dataset.empty || e.button !== 0) return;
    if (!p.canEdit) {
      p.onSelect(null);
      return;
    }
    const goalId = t.dataset.goal ?? null;
    const row = goalId ? layout.find((r) => r.g.id === goalId) : null;
    if (row && row.g.status !== 'active') return;
    const x = trackX(e);
    const top = row ? row.top + ROW + (row.show ? row.subs.length * SUBH : 0) - 4 : bodyH + 14;
    setDrag({ kind: 'create', goalId: row ? row.g.id : null, x0: x, x1: x, top, h: row ? 14 : 30 });
    e.preventDefault();
  };

  const todayX = dx(today);

  return (
    <div className="tl glass">
      <div className="tl-scroll no-scrollbar-x" ref={scroller} onScroll={onScroll}>
        <div className="tl-grid" style={{ width: namesW + trackW, minHeight: '100%' }}>
          {/* names header */}
          <div className="tl-names-head" style={{ width: namesW, height: HEAD }}>
            {!p.folded && (
              <>
                <span className="label">GOAL</span>
                <FilterButton {...p} />
              </>
            )}
            <button className="icon-btn tl-fold" onClick={p.onFold} aria-label={p.folded ? 'Unfold the names column' : 'Fold the names column'} title={p.folded ? 'Unfold' : 'Fold'}>
              <IconDoubleChevron dir={p.folded ? 'right' : 'left'} />
            </button>
          </div>
          {/* periods header */}
          <div className="tl-head" style={{ left: namesW, width: trackW, height: HEAD }}>
            {periods.map((pr) => (
              <div key={pr.key} className="tl-period" style={{ left: pr.x, width: pr.w }}>
                <span className={`tl-period-label${pr.current ? ' current' : ''}`}>{pr.label}</span>
                {pr.sub && <span className="tl-period-sub">{pr.sub}</span>}
              </div>
            ))}
            <span className="tl-today-tag mono" style={{ left: todayX }}>
              TODAY
            </span>
          </div>
          {/* names column */}
          <div className="tl-names" style={{ width: namesW, top: HEAD, height: Math.max(bodyH, 0) }}>
            {layout.map((r, i) => (
              <div
                key={r.g.id}
                className={`tl-name-row${p.selected === r.g.id ? ' selected' : ''}${reorder?.id === r.g.id ? ' dragging' : ''}`}
                style={{ top: r.top, height: r.h, transform: `translateY(${shiftFor(i)}px)` }}
              >
                <NameRow
                  r={r}
                  folded={p.folded}
                  canEdit={p.canEdit}
                  selected={p.selected === r.g.id}
                  onToggleSubs={() => p.onToggleSubs(r.g.id)}
                  onColour={(el) => p.onColour(r.g, el)}
                  onGrab={(e) => {
                    if (e.button !== 0) return;
                    setDrag({ kind: 'reorder', id: r.g.id, py0: e.clientY, dy: 0, moved: false });
                  }}
                  onToggleSub={p.onToggleSub}
                  onEditSub={p.onEditSub}
                  onKeySelect={() => p.onSelect(p.selected === r.g.id ? null : r.g.id)}
                  onKeyMove={(dir) => {
                    const ids = p.goals.map((g) => g.id);
                    const j = i + dir;
                    if (j < 0 || j >= ids.length) return;
                    [ids[i], ids[j]] = [ids[j], ids[i]];
                    p.onReorder(ids);
                  }}
                />
              </div>
            ))}
          </div>
          {/* track */}
          <div
            ref={trackRef}
            className={`tl-track${p.canEdit ? ' editable' : ''}`}
            style={{ left: namesW, top: HEAD, width: trackW, height: Math.max(bodyH + 60, 200) }}
            onPointerDown={onTrackDown}
            data-empty="1"
          >
            {periods.map((pr) => (
              <div key={pr.key} className="tl-col" style={{ left: pr.x, width: pr.w }} data-empty="1" />
            ))}
            {layout.map((r, i) => (
              <GoalTrackRow
                key={r.g.id}
                r={r}
                dx={dx}
                px={px}
                todayX={todayX}
                canEdit={p.canEdit}
                selected={p.selected === r.g.id}
                shift={shiftFor(i)}
                drag={drag}
                onSelect={() => p.onSelect(p.selected === r.g.id ? null : r.g.id)}
                onSubDown={(sub, mode, e) => {
                  if (!p.canEdit) {
                    p.onEditSub(sub);
                    return;
                  }
                  e.stopPropagation();
                  setDrag({ kind: 'sub', sub, mode, px0: e.clientX, dx: 0, moved: false });
                }}
                onExtendDown={(e) => {
                  e.stopPropagation();
                  setDrag({ kind: 'extend', goal: r.g, px0: e.clientX, dx: 0 });
                }}
              />
            ))}
            {drag?.kind === 'create' && Math.abs(drag.x1 - drag.x0) > 2 && (
              <div
                className="tl-create"
                style={{ left: Math.min(drag.x0, drag.x1), width: Math.abs(drag.x1 - drag.x0), top: drag.top, height: drag.h }}
              >
                {fmtDateShort(dateAt(Math.min(drag.x0, drag.x1)))} → {fmtDateShort(dateAt(Math.max(drag.x0, drag.x1)))}
              </div>
            )}
            <div className="tl-today" style={{ left: todayX }} />
          </div>
        </div>
        {!p.goals.length && (
          <div className="tl-empty">Nothing on the timeline. Check the filter, or see every goal in the list view.</div>
        )}
      </div>
    </div>
  );
}

function alignStart(d: Date, zoom: Zoom): Date {
  if (zoom === 'week') return startOfWeek(d);
  if (zoom === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (zoom === 'quarter') return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  return new Date(d.getFullYear(), 0, 1);
}

function buildPeriods(t0: Date, t1: Date, zoom: Zoom, db: ReturnType<typeof useDB>) {
  const px = ZOOM_PX[zoom];
  const today = now();
  const x = (d: Date) => Math.round(((d.getTime() - t0.getTime()) / DAY) * px);
  const out: { key: string; x: number; w: number; label: string; sub: string; current: boolean }[] = [];
  const push = (s: Date, e: Date, label: string, sub: string) =>
    out.push({ key: dayKey(s), x: x(s), w: x(e) - x(s), label, sub, current: s <= today && today < e });
  if (zoom === 'week') {
    // Race number on top, date below.
    const races = racesSorted(db);
    const cur = driverRace(db);
    const byWeek = new Map(races.map((r) => [dayKey(raceWeekStart(r)), r.number]));
    const curWeek = cur ? raceWeekStart(cur).getTime() : startOfWeek(today).getTime();
    for (let d = startOfWeek(t0); d < t1; d = addDays(d, 7)) {
      let n = byWeek.get(dayKey(d));
      if (n == null && cur && d.getTime() > curWeek) n = cur.number + Math.round((d.getTime() - curWeek) / (7 * DAY));
      push(d, addDays(d, 7), n ? `RACE ${pad2(n)}` : 'WEEK', `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}${d.getMonth() === 0 && d.getDate() <= 7 ? ` ${d.getFullYear()}` : ''}`);
    }
  } else if (zoom === 'month') {
    for (let d = new Date(t0.getFullYear(), t0.getMonth(), 1); d < t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
      push(d, new Date(d.getFullYear(), d.getMonth() + 1, 1), MONTH_SHORT[d.getMonth()], d.getMonth() === 0 || !out.length ? String(d.getFullYear()) : '');
  } else if (zoom === 'quarter') {
    for (let d = new Date(t0.getFullYear(), Math.floor(t0.getMonth() / 3) * 3, 1); d < t1; d = new Date(d.getFullYear(), d.getMonth() + 3, 1))
      push(d, new Date(d.getFullYear(), d.getMonth() + 3, 1), `Q${Math.floor(d.getMonth() / 3) + 1}`, String(d.getFullYear()));
  } else {
    for (let y = t0.getFullYear(); y <= t1.getFullYear(); y++) push(new Date(y, 0, 1), new Date(y + 1, 0, 1), String(y), '');
  }
  return out;
}

function FilterButton(p: Props) {
  const [open, setOpen] = useState(false);
  const n = (p.filter.hideAchieved ? 1 : 0) + (p.filter.hideArchived ? 1 : 0);
  return (
    <div className="tl-filter">
      <button className="btn btn-xs btn-soft" aria-expanded={open} aria-label="Filter the timeline" onClick={() => setOpen((o) => !o)}>
        <IconFilter size={11} />
        FILTER{n ? ` · ${n}` : ''}
      </button>
      {open && (
        <div className="popover tl-filter-pop" role="group" aria-label="Hide on the timeline">
          <span className="label">HIDE ON THE TIMELINE</span>
          {(
            [
              ['hideAchieved', `Achieved goals (${p.counts.achieved})`],
              ['hideArchived', `Archived goals (${p.counts.archived})`],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="check-row">
              <input
                type="checkbox"
                className="checkbox"
                checked={p.filter[k]}
                onChange={() => p.onFilter({ ...p.filter, [k]: !p.filter[k] })}
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

type RowLayout = { g: Goal; subs: Subgoal[]; show: boolean; top: number; h: number };

function NameRow({
  r,
  folded,
  canEdit,
  selected,
  onToggleSubs,
  onColour,
  onGrab,
  onToggleSub,
  onEditSub,
  onKeySelect,
  onKeyMove,
}: {
  onKeySelect: () => void;
  onKeyMove: (dir: -1 | 1) => void;
  r: RowLayout;
  folded: boolean;
  canEdit: boolean;
  selected: boolean;
  onToggleSubs: () => void;
  onColour: (el: HTMLElement) => void;
  onGrab: (e: React.PointerEvent) => void;
  onToggleSub: (s: Subgoal) => void;
  onEditSub: (s: Subgoal) => void;
}) {
  const g = r.g;
  const active = g.status === 'active';
  const allSubs = r.subs;
  const sub = active
    ? `${fmtDur(g.weekly_target_min).toUpperCase()} / WEEK · DUE ${fmtDateSmart(g.due_date)}`
    : g.status === 'achieved'
      ? `ACHIEVED ${g.achieved_on ? fmtDateShort(g.achieved_on) : ''}`
      : `ARCHIVED${g.archived_on ? ` ${fmtDateShort(g.archived_on)}` : ''}`;
  const colour = (
    <button
      className="tl-colour"
      aria-label={`${g.name} colour. Change colour`}
      title="Change colour"
      onClick={(e) => onColour(e.currentTarget)}
    >
      <span className="dot goal-dot" style={{ background: g.color }} data-black={g.color.toUpperCase() === '#111111' ? '1' : undefined} />
    </button>
  );
  const chevron = active && allSubs.length > 0 && (
    <button className="tl-chevron" aria-label={r.show ? `Fold ${g.name}’s subgoals` : `Show ${g.name}’s subgoals`} aria-expanded={r.show} onClick={onToggleSubs}>
      <IconChevron size={11} dir={r.show ? 'down' : 'right'} />
    </button>
  );
  if (folded)
    return (
      <div className="tl-name-folded">
        {colour}
        {chevron}
      </div>
    );
  return (
    <>
      <div className={`tl-name-main${active ? '' : ' record'}`}>
        <span className="tl-chevron-slot">{chevron}</span>
        {colour}
        <button
          className="tl-name-btn"
          aria-pressed={selected}
          aria-label={`${g.name}. Drag, or Alt + arrow keys, to reorder.`}
          title={g.name}
          onPointerDown={onGrab}
          onClick={(e) => {
            if (e.detail === 0) onKeySelect();
          }}
          onKeyDown={(e) => {
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
              onKeyMove(e.key === 'ArrowUp' ? -1 : 1);
            }
          }}
        >
          <span className="tl-name">{g.name}</span>
          <span className="tl-name-sub mono">{sub}</span>
        </button>
      </div>
      {r.show &&
        allSubs.map((s) => (
          <div key={s.id} className="tl-sub-name">
            <input
              type="checkbox"
              className="checkbox small"
              checked={s.done}
              disabled={!canEdit}
              aria-label={`${s.done ? 'Done' : 'Not done'}: ${s.title}`}
              onChange={() => onToggleSub(s)}
              style={{ ['--tick' as string]: g.color }}
            />
            <button className={`tl-sub-title${s.done ? ' done' : ''}`} onClick={() => onEditSub(s)}>
              {s.title}
            </button>
          </div>
        ))}
    </>
  );
}

function GoalTrackRow({
  r,
  dx,
  px,
  todayX,
  canEdit,
  selected,
  shift,
  drag,
  onSelect,
  onSubDown,
  onExtendDown,
}: {
  r: RowLayout;
  dx: (d: string | Date) => number;
  px: number;
  todayX: number;
  canEdit: boolean;
  selected: boolean;
  shift: number;
  drag: Drag | null;
  onSelect: () => void;
  onSubDown: (s: Subgoal, mode: 'move' | 'start' | 'end', e: React.PointerEvent) => void;
  onExtendDown: (e: React.PointerEvent) => void;
}) {
  const g = r.g;
  const active = g.status === 'active';
  const achieved = g.status === 'achieved';
  const archived = g.status === 'archived';
  const endDate = achieved && g.achieved_on ? g.achieved_on : g.due_date;
  const extendBy = drag?.kind === 'extend' && drag.goal.id === g.id ? drag.dx : 0;
  const x0 = dx(g.start_date);
  const x1 = dx(endDate) + px + extendBy;
  const w = Math.max(4, x1 - x0);
  const pastW = Math.max(0, Math.min(w, todayX - x0));
  const black = g.color.toUpperCase() === '#111111';
  const colour = black ? 'var(--black-goal)' : g.color;
  const pastBg = archived ? 'rgba(var(--dk-rgb),0.22)' : achieved ? `color-mix(in srgb, ${colour} 75%, #fff)` : colour;
  return (
    <div
      className={`tl-row${selected ? ' selected' : ''}`}
      style={{ top: r.top, height: r.h, transform: shift ? `translateY(${shift}px)` : undefined }}
      data-empty="1"
      data-goal={g.id}
    >
      <button
        className="tl-bar"
        style={{ left: x0, width: w, ['--c' as string]: colour }}
        aria-label={`${g.name}, ${achieved ? 'achieved' : archived ? 'archived' : `due ${fmtDateShort(g.due_date)}`}`}
        onClick={onSelect}
      >
        <span className="tl-bar-past" style={{ width: pastW, background: pastBg }} />
        {w >= 90 && <span className="tl-bar-label">{g.smart_s || g.name}</span>}
      </button>
      {active && canEdit && (
        <span className="tl-extend" style={{ left: x0 + w - 8 }} onPointerDown={onExtendDown} title="Drag to move the deadline later" />
      )}
      <div className="tl-pole" style={{ left: x0 + w }} />
      <span className="tl-due mono" style={{ left: x0 + w }}>
        <span>{fmtDateSmart(extendBy ? dayKey(addDays(fromDayKey(g.due_date), Math.round(extendBy / px))) : endDate)}</span>
        <Flag size={16} />
      </span>
      {r.show &&
        r.subs.map((s, i) => {
          const dragging = drag?.kind === 'sub' && drag.sub.id === s.id ? drag : null;
          let sx = dx(s.start_date);
          let ex = dx(s.due_date) + px;
          if (dragging) {
            if (dragging.mode !== 'end') sx += dragging.dx;
            if (dragging.mode !== 'start') ex += dragging.dx;
          }
          const top = ROW + i * SUBH;
          const tip = `${s.title} · ${fmtDateShort(s.start_date)} → ${fmtDateShort(s.due_date)}`;
          return (
            <div key={s.id}>
              <button
                className={`tl-sub${s.done ? ' done' : ''}${canEdit ? ' editable' : ''}`}
                style={{ left: sx, width: Math.max(6, ex - sx), top: top + 6, ['--c' as string]: colour }}
                title={tip}
                aria-label={tip}
                onPointerDown={(e) => onSubDown(s, 'move', e)}
                onKeyDown={(e) => e.key === 'Enter' && onSubDown(s, 'move', e as unknown as React.PointerEvent)}
              >
                {canEdit && (
                  <>
                    <span className="tl-sub-h start" onPointerDown={(e) => { e.stopPropagation(); onSubDown(s, 'start', e); }} />
                    <span className="tl-sub-h end" onPointerDown={(e) => { e.stopPropagation(); onSubDown(s, 'end', e); }} />
                  </>
                )}
              </button>
              <span className={`tl-sub-label${s.done ? ' done' : ''}`} style={{ left: ex + 8, top: top + 1 }}>
                {s.title} · {fmtDateShort(s.start_date)} → {fmtDateSmart(s.due_date)}
              </span>
            </div>
          );
        })}
    </div>
  );
}
