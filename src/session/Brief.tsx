// BRIEF & START (brief §6 Mechanics session): one focus, one subgoal in focus per goal, planned hours
// per goal against its target, the debrief notes, and when the next race starts (SUN / MON + time, or
// START NOW). Starting the race ends the session. The brief is saved as you type.
import { useEffect, useState } from 'react';
import { store, useDB } from '../data/store';
import { startNextRace } from '../domain/race';
import { activeGoals, goalPlannedInRace, nextRaceAfter, raceDays, raceLabel, raceWeekStart, sessionRace, targetFor } from '../domain/selectors';
import { atTime, dayKey, fmtDayShort, fmtDur, fmtWeekRange, hhmm, now } from '../lib/time';
import { lastDebriefNotes } from '../pages/home/RacePlan';
import { Dialog } from '../ui/Dialog';
import { IconX } from '../ui/icons';
import { briefOpen, radioOpen, showToast } from '../ui/signals';
import './session.css';

export function BriefOverlay() {
  const open = briefOpen.use();
  const db = useDB();
  const ses = sessionRace(db);
  useEffect(() => {
    if (!ses && open) briefOpen.set(false);
  }, [ses, open]);
  if (!open || !ses) return null;
  return <BriefDialog />;
}

function BriefDialog() {
  const db = useDB();
  const ses = sessionRace(db)!;
  const next = nextRaceAfter(db, ses)!;
  const brief = db.briefs.find((b) => b.race_id === next.id);
  const goals = activeGoals(db);
  const notes = lastDebriefNotes(db, next.number);
  const days = raceDays(next).slice(0, 2).map(dayKey); // SUN, MON
  const savedStart = brief?.start_at ? new Date(brief.start_at) : null;
  const [focus, setFocus] = useState(brief?.focus ?? '');
  const [day, setDay] = useState(savedStart && days.includes(dayKey(savedStart)) ? dayKey(savedStart) : days[0]);
  const [time, setTime] = useState(savedStart ? hhmm(savedStart) : '09:00');
  const [error, setError] = useState('');

  const save = (patch: { focus?: string; subgoal_focus?: Record<string, string> }) => {
    const t = store.tx();
    const b = t.db.briefs.find((x) => x.race_id === next.id);
    if (b) t.update('briefs', b.id, { ...patch, subgoal_focus: patch.subgoal_focus ? { ...b.subgoal_focus, ...patch.subgoal_focus } : b.subgoal_focus });
    else t.insert('briefs', { race_id: next.id, focus: patch.focus ?? '', subgoal_focus: patch.subgoal_focus ?? {}, start_at: null });
    t.commit();
  };
  const close = () => {
    if (focus !== (brief?.focus ?? '')) save({ focus });
    briefOpen.set(false);
  };
  const start = (at: Date) => {
    if (focus !== (brief?.focus ?? '')) save({ focus });
    const t = store.tx();
    const checks = t.db.session_checks.find((c) => c.race_id === ses.id);
    if (checks && !checks.brief) {
      t.update('session_checks', checks.id, { brief: true });
      t.commit();
    }
    startNextRace(store, at);
    briefOpen.set(false);
    radioOpen.set(false);
    showToast(at.getTime() <= now().getTime() + 60_000 ? `${raceLabel(next).replace('RACE', 'Race')} is on track.` : `${raceLabel(next).replace('RACE', 'Race')} starts ${fmtDayShort(at)} ${hhmm(at)}.`);
  };
  const startAt = atTime(day, time || '09:00');

  return (
    <Dialog label={`${raceLabel(next)} brief`} onClose={close} width={1100} className="brief">
      <div className="brief-head">
        <div>
          <span className="label label-red">BRIEF AND START TIME</span>
          <h2 className="display brief-title">{raceLabel(next)} BRIEF</h2>
        </div>
        <span className="mono brief-dates">{fmtWeekRange(raceWeekStart(next))}</span>
        <button className="icon-btn" aria-label="Close the brief" onClick={close} style={{ marginLeft: 'auto' }}>
          <IconX />
        </button>
      </div>
      <div className="brief-body">
        <div className="brief-left">
          <label className="field">
            <span className="mono brief-h">FOCUS FOR THIS RACE</span>
            <input className="input brief-focus" placeholder="One thing that matters most this race" value={focus} onChange={(e) => setFocus(e.target.value)} onBlur={() => save({ focus })} />
          </label>
          <div className="brief-subs">
            <span className="mono brief-h">SUBGOAL FOCUS · PICK ONE PER GOAL</span>
            {goals.map((g) => {
              const subs = db.subgoals.filter((s) => s.goal_id === g.id && !s.done).sort((a, b) => a.start_date.localeCompare(b.start_date));
              const picked = brief?.subgoal_focus[g.id];
              return (
                <div key={g.id} className="brief-goal" style={{ ['--c' as string]: g.color }}>
                  <span className="brief-goal-name">
                    <strong>{g.name}</strong>
                    <span className="mono">
                      {fmtDur(goalPlannedInRace(db, next.id, g.id)).toUpperCase()} PLANNED · TARGET {fmtDur(targetFor(db, next.id, g)).toUpperCase()}
                    </span>
                  </span>
                  <div role="radiogroup" aria-label={`Subgoal in focus for ${g.name}`} className="chips">
                    {!subs.length && <span className="muted small">No open subgoals.</span>}
                    {subs.map((s) => (
                      <button key={s.id} role="radio" aria-checked={picked === s.id} className="chip brief-chip" onClick={() => save({ subgoal_focus: { [g.id]: picked === s.id ? '' : s.id } })}>
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="brief-right">
          <div className="brief-notes">
            <span className="mono brief-h">FROM THE DEBRIEF</span>
            {!notes.length && <p className="muted small">No notes yet. Notes you write in the debrief show up here.</p>}
            {notes.map((n, i) => (
              <p key={i} className="plan-note">
                {n}
              </p>
            ))}
          </div>
          <div className="brief-start">
            <span className="mono brief-h">{raceLabel(next)} STARTS</span>
            <div className="chips" role="group" aria-label="Start day">
              {days.map((k) => (
                <button key={k} className="chip mono-chip" aria-pressed={day === k} onClick={() => (setDay(k), setError(''))}>
                  {fmtDayShort(new Date(`${k}T00:00`))}
                </button>
              ))}
              <input type="time" step={900} className="input mono-input" aria-label="Start time" value={time} onChange={(e) => (setTime(e.target.value), setError(''))} />
            </div>
            {error && <span className="error-text">{error}</span>}
            <div className="brief-start-actions">
              <button className="btn btn-outline" onClick={() => start(now())}>
                START NOW
              </button>
              <button
                className="btn btn-red"
                onClick={() => {
                  if (startAt.getTime() <= now().getTime()) return setError('That time has passed. Pick a later one, or START NOW.');
                  start(startAt);
                }}
              >
                START {raceLabel(next)} · {fmtDayShort(startAt)} {hhmm(startAt)}
              </button>
            </div>
            <span className="muted small">Starting the race ends the session.</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
