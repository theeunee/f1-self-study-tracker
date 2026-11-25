// Goal history (brief §6 Goals): all laps and total hours by default; the card's weekly bars pick one
// week; deadline moves appear as marks; export as .txt or copy.
import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import type { Goal } from '../../data/types';
import { recordedMin, timesOf } from '../../domain/selectors';
import { useNowMs } from '../../lib/hooks';
import { addDays, dayKey, fmtDateShort, fmtDayShort, fmtDur, fromDayKey, startOfWeek } from '../../lib/time';
import { Dialog } from '../../ui/Dialog';
import { IconX } from '../../ui/icons';
import { showToast } from '../../ui/signals';

interface Entry {
  date: Date;
  title: string;
  min: number;
  how: string;
}

export function HistoryDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const db = useDB();
  const nowMs = useNowMs(30000);
  const [week, setWeek] = useState<string | null>(null);

  const { entries, weeks, marks } = useMemo(() => {
    const entries: Entry[] = [];
    for (const lap of db.laps.filter((l) => l.goal_id === goal.id)) {
      const times = timesOf(db, lap.id);
      if (!times.length) continue;
      const min = recordedMin(db, lap.id, nowMs);
      const allHand = times.every((t) => t.how === 'by_hand');
      const anyHand = times.some((t) => t.how === 'by_hand');
      entries.push({ date: new Date(times[0].started_at), title: lap.title, min, how: allHand ? 'BY HAND' : anyHand ? 'TIMED + HAND' : 'TIMED' });
    }
    entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    const marks = db.goal_marks.filter((m) => m.goal_id === goal.id).map((m) => ({ date: fromDayKey(m.made_on), from: m.from_date, to: m.to_date }));
    // Every week from the first record (or the goal start) to now.
    const firstMs = Math.min(fromDayKey(goal.start_date).getTime(), ...entries.map((e) => e.date.getTime()));
    const weeks: { key: string; start: Date; min: number; laps: number }[] = [];
    for (let w = startOfWeek(firstMs); w.getTime() <= nowMs; w = addDays(w, 7)) {
      const end = addDays(w, 7).getTime();
      const inW = entries.filter((e) => e.date.getTime() >= w.getTime() && e.date.getTime() < end);
      weeks.push({ key: dayKey(w), start: w, min: inW.reduce((s, e) => s + e.min, 0), laps: inW.length });
    }
    return { entries, weeks, marks };
  }, [db, goal, nowMs]);

  const total = entries.reduce((s, e) => s + e.min, 0);
  const best = weeks.reduce((b, w) => (w.min > b ? w.min : b), 0);
  const maxW = Math.max(1, best);
  const scoped = week ? entries.filter((e) => dayKey(startOfWeek(e.date)) === week) : entries;
  const scopedMarks = week ? marks.filter((m) => dayKey(startOfWeek(m.date)) === week) : marks;
  const scopeTotal = scoped.reduce((s, e) => s + e.min, 0);
  const weekRange = (start: Date) => {
    const end = addDays(start, 6);
    return start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${fmtDateShort(end).split(' ')[1]}`
      : `${fmtDateShort(start)} – ${fmtDateShort(end)}`;
  };

  // Group by week, newest first.
  const groups = useMemo(() => {
    const map = new Map<string, { start: Date; items: (Entry | { mark: true; date: Date; from: string; to: string })[]; total: number }>();
    const touch = (d: Date) => {
      const k = dayKey(startOfWeek(d));
      if (!map.has(k)) map.set(k, { start: startOfWeek(d), items: [], total: 0 });
      return map.get(k)!;
    };
    for (const e of scoped) {
      const g = touch(e.date);
      g.items.push(e);
      g.total += e.min;
    }
    for (const m of scopedMarks) touch(m.date).items.push({ mark: true, ...m });
    for (const g of map.values()) g.items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ key: k, ...v }));
  }, [scoped, scopedMarks]);

  const text = useMemo(() => {
    const lines = [`${goal.name} · history`, `${fmtDur(total)} · ${entries.length} laps`, ''];
    for (const g of groups) {
      lines.push(`WEEK ${weekRange(g.start)} · ${fmtDur(g.total)}`);
      for (const it of g.items) {
        if ('mark' in it) lines.push(`  ${fmtDayShort(it.date)}  Deadline moved ${fmtDateShort(it.from)} → ${fmtDateShort(it.to)}`);
        else lines.push(`  ${fmtDayShort(it.date)}  ${it.title} · ${fmtDur(it.min)} (${it.how.toLowerCase()})`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }, [groups, goal.name, total, entries.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportTxt = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${goal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-history.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog label={`${goal.name} history`} onClose={onClose} width={1040} className="history">
      <div className="hist-head">
        <div>
          <span className="label label-red">HISTORY</span>
          <h2>{goal.name}</h2>
        </div>
        <button className="icon-btn" aria-label="Close history" onClick={onClose}>
          <IconX />
        </button>
      </div>
      <div className="hist-body">
        <div className="hist-left">
          <div className="hist-card" style={{ background: goal.color }}>
            <span className="mono hist-card-kicker">ITERACE · {goal.name.toUpperCase()}</span>
            <span className="hist-card-big">
              <span className="display">{(total / 60).toFixed(1)}</span>
              <span className="mono">HOURS ON TRACK</span>
            </span>
            <div className="hist-card-stats mono">
              <span>
                <span>LAPS</span>
                <strong>{entries.length}</strong>
              </span>
              <span>
                <span>WEEKS</span>
                <strong>{weeks.filter((w) => w.min > 0).length}</strong>
              </span>
              <span>
                <span>BEST WEEK</span>
                <strong>{fmtDur(best)}</strong>
              </span>
            </div>
            <div className="hist-bars" role="group" aria-label="Hours by week. Pick a week to see only its laps.">
              {weeks.map((w) => (
                <button
                  key={w.key}
                  className="hist-bar"
                  aria-pressed={week === w.key}
                  title={`${weekRange(w.start)} · ${fmtDur(w.min)}`}
                  aria-label={`Week ${weekRange(w.start)}, ${fmtDur(w.min)}`}
                  style={{ height: `${Math.max(4, (w.min / maxW) * 100)}%` }}
                  onClick={() => setWeek(week === w.key ? null : w.key)}
                />
              ))}
            </div>
            <span className="mono hist-card-foot">EVERY WEEK · SINCE {fmtDateShort(weeks[0]?.start ?? goal.start_date)} · CLICK A BAR</span>
          </div>
          <div className="hist-export">
            <button className="btn btn-sm btn-solid" onClick={exportTxt}>
              EXPORT AS .TXT
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => navigator.clipboard?.writeText(text).then(() => showToast('History copied.'), () => showToast('Couldn’t copy.'))}
            >
              COPY TEXT
            </button>
          </div>
        </div>
        <div className="hist-right">
          <div className="hist-scope">
            <div>
              <span className="label">{week ? `WEEK · ${weekRange(fromDayKey(week)).toUpperCase()}` : 'ALL RECORDS'}</span>
              <strong className="mono">
                {fmtDur(scopeTotal)} · {scoped.length} LAPS
              </strong>
            </div>
            {week && (
              <button className="btn btn-xs btn-outline" onClick={() => setWeek(null)}>
                ALL RECORDS
              </button>
            )}
          </div>
          <div className="hist-list">
            {!groups.length && <p className="muted">No laps recorded for this goal yet.</p>}
            {groups.map((g) => (
              <div key={g.key} className="hist-group">
                {!week && (
                  <div className="hist-group-head label">
                    <span>WEEK · {weekRange(g.start).toUpperCase()}</span>
                    <span>{fmtDur(g.total)}</span>
                  </div>
                )}
                {g.items.map((it, i) =>
                  'mark' in it ? (
                    <div key={`m${i}`} className="hist-item mark">
                      <span className="mono">{fmtDayShort(it.date)}</span>
                      <span className="label label-red">DEADLINE MOVED</span>
                      <span>
                        {fmtDateShort(it.from)} → {fmtDateShort(it.to)}
                      </span>
                    </div>
                  ) : (
                    <div key={i} className="hist-item">
                      <span className="mono">{fmtDayShort(it.date)}</span>
                      <span>{it.title}</span>
                      <span className="mono">{fmtDur(it.min)}</span>
                      <span className="label">{it.how}</span>
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

