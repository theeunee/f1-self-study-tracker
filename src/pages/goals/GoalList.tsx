import { useDB } from '../../data/store';
import type { Goal } from '../../data/types';
import { driverRace, goalDoneInRace, goalTotalMin, racesLeft, sessionRace, smartScore, targetFor } from '../../domain/selectors';
import { daysBetween } from '../../domain/goals';
import { useNowMs, usePref } from '../../lib/hooks';
import { DAY, daysUntil, fmtDateLong, fmtDateShort, fmtDur, fromDayKey, now } from '../../lib/time';
import { IconChevron } from '../../ui/icons';

export function GoalList({
  active,
  achieved,
  archived,
  selected,
  onSelect,
}: {
  active: Goal[];
  achieved: Goal[];
  archived: Goal[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = usePref<Record<string, boolean>>('goals.listOpen', { active: true, achieved: true, archived: false });
  const groups: [string, string, Goal[]][] = [
    ['active', 'ACTIVE', active],
    ['achieved', 'ACHIEVED', achieved],
    ['archived', 'ARCHIVED', archived],
  ];
  return (
    <div id="goals-list" className="goal-list glass">
      {groups
        .filter(([, , list]) => list.length)
        .map(([key, title, list]) => (
          <div key={key} className="gl-group">
            <button className="gl-group-head label" aria-expanded={open[key] !== false} onClick={() => setOpen((o) => ({ ...o, [key]: o[key] === false }))}>
              <IconChevron size={11} dir={open[key] !== false ? 'down' : 'right'} />
              {title} · {list.length}
            </button>
            {open[key] !== false &&
              list.map((g) => <GoalCard key={g.id} goal={g} pressed={selected === g.id} onSelect={() => onSelect(selected === g.id ? null : g.id)} />)}
          </div>
        ))}
    </div>
  );
}

function GoalCard({ goal, pressed, onSelect }: { goal: Goal; pressed: boolean; onSelect: () => void }) {
  const db = useDB();
  const nowMs = useNowMs(30000);
  const subs = db.subgoals.filter((s) => s.goal_id === goal.id);
  const subsDone = subs.filter((s) => s.done).length;
  const total = goalTotalMin(db, goal.id, nowMs);
  const laps = db.laps.filter((l) => l.goal_id === goal.id && db.lap_times.some((t) => t.lap_id === l.id)).length;
  const stat = (label: string, value: string, sub?: string, red?: boolean) => (
    <span className="gl-stat">
      <span className="label">{label}</span>
      <span className="gl-stat-val mono">{value}</span>
      {sub && <span className={`label${red ? ' label-red' : ''}`}>{sub}</span>}
    </span>
  );
  if (goal.status === 'active') {
    const race = sessionRace(db) ?? driverRace(db);
    const did = goalDoneInRace(db, race?.id, goal.id, nowMs);
    const target = targetFor(db, race?.id, goal);
    const dd = daysUntil(goal.due_date);
    return (
      <button className="gl-card" aria-pressed={pressed} onClick={onSelect} style={{ ['--c' as string]: goal.color }}>
        <span className="gl-main">
          <span className="gl-name">{goal.name}</span>
          <span className="gl-statement">{goal.smart_s}</span>
        </span>
        {stat('DUE', fmtDateLong(goal.due_date), `D-${Math.max(0, dd)} · ${racesLeft(goal.due_date, now())} RACES`, true)}
        {stat('WEEKLY', fmtDur(goal.weekly_target_min))}
        <span className="gl-stat gl-wide">
          <span className="label">
            THIS RACE · {fmtDur(did).toUpperCase()} / {fmtDur(target).toUpperCase()}
          </span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.min(100, (did / Math.max(1, target)) * 100)}%`, background: goal.color }} />
          </span>
        </span>
        {stat('SUBGOALS', `${subsDone} / ${subs.length}`)}
        {stat('SMART', `${smartScore(goal)} / 5`)}
      </button>
    );
  }
  const achieved = goal.status === 'achieved';
  const endKey = (achieved ? goal.achieved_on : goal.archived_on) ?? goal.due_date;
  const days = daysBetween(goal.start_date, endKey);
  const races = Math.max(1, Math.ceil(((fromDayKey(endKey).getTime() - fromDayKey(goal.start_date).getTime()) / DAY + 1) / 7));
  return (
    <button className="gl-card record" aria-pressed={pressed} onClick={onSelect} style={{ ['--c' as string]: goal.color }}>
      <span className="gl-main">
        <span className="gl-name">
          {goal.name} <span className="gl-chip mono">{achieved ? 'ACHIEVED' : 'ARCHIVED'}</span>
        </span>
        <span className="gl-statement">{goal.smart_s}</span>
      </span>
      {stat(`START → ${achieved ? 'ACHIEVED' : 'ARCHIVED'}`, `${fmtDateShort(goal.start_date)} → ${fmtDateShort(endKey)}`, `${days} DAYS`)}
      {achieved ? stat('RACES', String(races), 'TO GET THERE') : stat('WEEKLY TARGET', fmtDur(goal.weekly_target_min))}
      {achieved
        ? stat('WEEKLY AVERAGE', fmtDur(total / races), `TARGET ${fmtDur(goal.weekly_target_min).toUpperCase()}`)
        : stat('TOTAL LOGGED', fmtDur(total), `${laps} LAPS`)}
      {achieved ? stat('TOTAL', fmtDur(total), `${laps} LAPS`) : stat('SUBGOALS', `${subsDone} / ${subs.length}`)}
      {stat('SMART', `${smartScore(goal)} / 5`)}
    </button>
  );
}
