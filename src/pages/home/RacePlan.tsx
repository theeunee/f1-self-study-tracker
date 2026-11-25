// RACE PLAN (brief §6 Home): the read-only brief written in the last session.
import { useDB } from '../../data/store';
import { activeGoals, countedLaps, driverRace, goalOf, raceDays, raceLabel, raceWeekStart, racesSorted, targetFor } from '../../domain/selectors';
import { DAY_SHORT, dayKey, fmtDateLong, fmtDur, fmtWeekRange, hhmm } from '../../lib/time';
import { Dialog } from '../../ui/Dialog';
import { Flag, IconX } from '../../ui/icons';

export function lastDebriefNotes(db: ReturnType<typeof useDB>, beforeNumber: number): string[] {
  const prev = racesSorted(db).filter((r) => r.number < beforeNumber).at(-1);
  if (!prev) return [];
  const d = db.debriefs.find((x) => x.race_id === prev.id);
  if (!d) return [];
  const out: string[] = [];
  if (d.why.trim()) out.push(d.why.trim());
  for (const [gid, note] of Object.entries(d.goal_notes)) {
    if (!note.trim()) continue;
    const g = goalOf(db, gid);
    out.push(g ? `${g.name}: ${note.trim()}` : note.trim());
  }
  return out;
}

export function RacePlan({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const race = driverRace(db);
  if (!race) return null;
  const brief = db.briefs.find((b) => b.race_id === race.id);
  const goals = activeGoals(db);
  const laps = countedLaps(db, race.id).filter((l) => l.planned_start);
  const days = raceDays(race);
  const today = dayKey(Date.now());
  const stints = days.map((d) => {
    const k = dayKey(d);
    const segs = goals
      .map((g) => ({ g, min: laps.filter((l) => l.goal_id === g.id && dayKey(l.planned_start!) === k).reduce((s, l) => s + l.planned_min, 0) }))
      .filter((s) => s.min > 0);
    const other = laps.filter((l) => !l.goal_id && dayKey(l.planned_start!) === k).reduce((s, l) => s + l.planned_min, 0);
    return { k, d, segs, other, total: segs.reduce((s, x) => s + x.min, 0) + other };
  });
  const maxDay = Math.max(60, ...stints.map((s) => s.total));
  const total = stints.reduce((s, x) => s + x.total, 0);
  const notes = lastDebriefNotes(db, race.number);
  const focusEntries = Object.entries(brief?.subgoal_focus ?? {})
    .map(([gid, sid]) => ({ g: goalOf(db, gid), s: db.subgoals.find((x) => x.id === sid) }))
    .filter((x) => x.g && x.s);

  return (
    <Dialog label={`${raceLabel(race)} race plan`} onClose={onClose} width={1060} className="plan">
      <div className="plan-head">
        <h2 className="display plan-title">{raceLabel(race)}</h2>
        <div className="plan-meta mono">
          <span>RACE PLAN · {fmtWeekRange(raceWeekStart(race))}</span>
          <span className="plan-set">{brief ? `SET IN THE MECHANICS SESSION · ${fmtDateLong(brief.updated_at).replace(/ \d{4}$/, '')}, ${hhmm(brief.updated_at)}` : 'NO BRIEF WRITTEN FOR THIS RACE'}</span>
        </div>
        <span className="plan-flag" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Flag key={i} size={40} />
          ))}
        </span>
        <button className="icon-btn plan-x" onClick={onClose} aria-label="Close the race plan">
          <IconX />
        </button>
      </div>
      <div className="plan-body">
        <div className="plan-col">
          <section>
            <h3 className="mono">FOCUS FOR THIS RACE</h3>
            <p className="plan-focus">{brief?.focus || 'No focus was set.'}</p>
          </section>
          <section>
            <h3 className="mono">STINTS · PLANNED HOURS BY DAY</h3>
            <div className="stints">
              {stints.map((s) => (
                <div key={s.k} className={`stint${s.k === today ? ' today' : ''}`}>
                  <div className="stint-bar">
                    {s.other > 0 && <span title={`No goal · ${fmtDur(s.other)}`} style={{ height: `${(s.other / maxDay) * 100}%`, background: '#8F8F97' }} />}
                    {s.segs.map((sg) => (
                      <span key={sg.g.id} title={`${sg.g.name} · ${fmtDur(sg.min)}`} style={{ height: `${(sg.min / maxDay) * 100}%`, background: sg.g.color }} />
                    ))}
                  </div>
                  <span className="mono stint-label">
                    {DAY_SHORT[s.d.getDay()]} {s.d.getDate()}
                  </span>
                  <span className="mono stint-total">{s.total ? fmtDur(s.total) : '–'}</span>
                </div>
              ))}
            </div>
            <div className="plan-total">
              <span className="mono">TOTAL PLANNED</span>
              <strong>{fmtDur(total)}</strong>
            </div>
          </section>
        </div>
        <div className="plan-col">
          <section>
            <h3 className="mono">TARGETS · PLANNED / WEEKLY TARGET</h3>
            {goals.map((g) => {
              const planned = laps.filter((l) => l.goal_id === g.id).reduce((s, l) => s + l.planned_min, 0);
              const target = targetFor(db, race.id, g);
              const diff = planned - target;
              return (
                <div key={g.id} className="plan-target">
                  <div className="plan-target-top">
                    <span className="dot" style={{ background: g.color }} />
                    <span>{g.name}</span>
                    <span className="mono">
                      {fmtDur(planned)} / {fmtDur(target)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.min(100, (planned / Math.max(1, target)) * 100)}%`, background: g.color }} />
                  </div>
                  <span className="label">{diff === 0 ? 'ON TARGET' : diff < 0 ? `${fmtDur(-diff).toUpperCase()} UNDER TARGET` : `${fmtDur(diff).toUpperCase()} OVER TARGET`}</span>
                </div>
              );
            })}
          </section>
          <section>
            <h3 className="mono">SUBGOAL FOCUS</h3>
            {!focusEntries.length && <p className="muted small">No subgoals were picked for this race.</p>}
            {focusEntries.map(({ g, s }) => (
              <div key={s!.id} className="plan-sub" style={{ ['--c' as string]: g!.color }}>
                <span>
                  <span className="mono plan-sub-goal">{g!.name.toUpperCase()}</span>
                  <span>{s!.title}</span>
                </span>
                <span className="mono">BY {fmtDateLong(s!.due_date).replace(/ \d{4}$/, '')}</span>
              </div>
            ))}
          </section>
          <section>
            <h3 className="mono">FROM THE LAST DEBRIEF</h3>
            {!notes.length && <p className="muted small">No notes from the last debrief.</p>}
            {notes.map((n, i) => (
              <p key={i} className="plan-note">
                {n}
              </p>
            ))}
          </section>
        </div>
      </div>
      <div className="plan-foot">
        <span className="muted">You write this at the end of each Mechanics session. During the race it’s read-only.</span>
        <button className="btn btn-outline" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </Dialog>
  );
}
