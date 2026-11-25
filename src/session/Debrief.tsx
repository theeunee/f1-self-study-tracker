// Mechanics session · Home becomes the debrief (brief §6): laps done, hours vs planned, hours vs
// targets; per goal a did / planned (faded) / target bar with an optional note; the radio notes;
// an optional "What got in the way?" box. Notes are saved as you type and feed the brief.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store, useDB } from '../data/store';
import type { Race } from '../data/types';
import { activeGoals, countedLaps, goalDoneInRace, goalPlannedInRace, lapIsDone, raceLabel, raceWeekStart, recordedMin, sessionRace, targetFor, nextRaceAfter } from '../domain/selectors';
import { useNowMs } from '../lib/hooks';
import { fmtDayShort, fmtDur, fmtWeekRange, hhmm, MONTH_SHORT } from '../lib/time';
import { deltaPill } from '../pages/home/LapsPanel';
import '../pages/home/home.css';
import './session.css';

function saveDebrief(race: Race, patch: { why?: string; goal_notes?: Record<string, string> }) {
  const t = store.tx();
  const d = t.db.debriefs.find((x) => x.race_id === race.id);
  if (d) t.update('debriefs', d.id, { ...patch, goal_notes: patch.goal_notes ? { ...d.goal_notes, ...patch.goal_notes } : d.goal_notes });
  else t.insert('debriefs', { race_id: race.id, why: patch.why ?? '', goal_notes: patch.goal_notes ?? {} });
  t.commit();
}

/** A text field that saves on pause and on blur. */
function useDebounced(save: (v: string) => void, initial: string) {
  const [v, setV] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return {
    value: v,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value;
      setV(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(next), 500);
    },
    onBlur: () => {
      if (timer.current) clearTimeout(timer.current);
      latest.current(v);
    },
  };
}

export function Debrief() {
  const db = useDB();
  const nowMs = useNowMs(30000);
  const nav = useNavigate();
  const race = sessionRace(db)!;
  const next = nextRaceAfter(db, race);
  const debrief = db.debriefs.find((d) => d.race_id === race.id);
  const goals = activeGoals(db);
  const laps = countedLaps(db, race.id).filter((l) => l.planned_start);
  const done = laps.filter((l) => lapIsDone(db, l, nowMs)).length;
  const did = laps.reduce((s, l) => s + recordedMin(db, l.id, nowMs), 0);
  const planned = laps.reduce((s, l) => s + l.planned_min, 0);
  const targets = goals.reduce((s, g) => s + targetFor(db, race.id, g), 0);
  const short = targets - did;
  const why = useDebounced((v) => saveDebrief(race, { why: v }), debrief?.why ?? '');
  const notes = db.log_entries.filter((e) => e.race_id === race.id && !e.undone && e.note.trim()).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const noGoalDid = goalDoneInRace(db, race.id, null, nowMs);

  return (
    <div className="debrief glass">
      <div className="db-head">
        <div>
          <span className="label label-red">MECHANICS SESSION · DEBRIEF</span>
          <h1 className="display db-title">
            {raceLabel(race)} DEBRIEF <span className="mono db-dates">{fmtWeekRange(raceWeekStart(race))}</span>
          </h1>
        </div>
        <div className="db-stats">
          <div className="db-stat">
            <span className="label">LAPS DONE</span>
            <strong>
              {done} / {laps.length}
            </strong>
            <span className="label">{Math.round((done / Math.max(1, laps.length)) * 100)}% OF THE PLAN</span>
          </div>
          <div className="db-stat">
            <span className="label">HOURS</span>
            <strong>{fmtDur(did)}</strong>
            <span className="label">OF {fmtDur(planned).toUpperCase()} PLANNED</span>
          </div>
          <div className="db-stat">
            <span className="label">VS TARGETS</span>
            <strong>{fmtDur(targets)}</strong>
            <span className={`label${short > 0 ? ' label-red' : ''}`}>{short > 0 ? `${fmtDur(short).toUpperCase()} SHORT` : short < 0 ? `${fmtDur(-short).toUpperCase()} OVER` : 'ON TARGET'}</span>
          </div>
        </div>
      </div>
      <div className="db-body">
        <div className="db-goals">
          <div className="db-goals-head">
            <span className="mono">GOALS · DID / PLANNED / TARGET</span>
            <span className="db-legend mono">
              <span>
                <i className="lg-did" /> DID
              </span>
              <span>
                <i className="lg-plan" /> PLANNED
              </span>
              <span>
                <i className="lg-target" /> TARGET
              </span>
            </span>
          </div>
          {goals.map((g) => {
            const d = goalDoneInRace(db, race.id, g.id, nowMs);
            const p = goalPlannedInRace(db, race.id, g.id);
            const t = targetFor(db, race.id, g);
            const max = Math.max(d, p, t, 1);
            const pill = deltaPill(d - p);
            return (
              <GoalRow key={g.id} raceObj={race} goalId={g.id} name={g.name} color={g.color} d={d} p={p} t={t} max={max} pill={pill} note={debrief?.goal_notes[g.id] ?? ''} />
            );
          })}
          {noGoalDid > 0 && (
            <div className="db-goal">
              <div className="db-goal-top">
                <span className="dot" style={{ background: '#8F8F97' }} />
                <span className="db-goal-name">No goal</span>
                <span className="mono db-nums">{fmtDur(noGoalDid)} recorded</span>
              </div>
            </div>
          )}
        </div>
        <div className="db-side">
          <div className="db-radio">
            <span className="mono">FROM THE RADIO</span>
            {!notes.length && <p className="muted small">No notes this race. Notes you add in the radio log show up here.</p>}
            {notes.map((e) => {
              const d = new Date(e.created_at);
              return (
                <div key={e.id} className="db-note">
                  <span className="mono">
                    {fmtDayShort(d)} {MONTH_SHORT[d.getMonth()]} {hhmm(d)} · {e.main}
                  </span>
                  <span className="db-note-text">{e.note}</span>
                </div>
              );
            })}
          </div>
          <label className="field db-why">
            <span className="mono">WHAT GOT IN THE WAY? · OPTIONAL</span>
            <textarea className="textarea" rows={4} placeholder="e.g. Two late nights killed Thursday. Plan lighter evenings before deadlines." {...why} />
          </label>
        </div>
      </div>
      <div className="db-foot">
        <span className="muted">Your answer and goal notes go into {raceLabel(next).replace('RACE', 'Race')}’s plan.</span>
        <button className="btn btn-red" onClick={() => nav('/race-week')}>
          NEXT · UNFINISHED LAPS →
        </button>
      </div>
    </div>
  );
}

function GoalRow({
  raceObj,
  goalId,
  name,
  color,
  d,
  p,
  t,
  max,
  pill,
  note,
}: {
  raceObj: Race;
  goalId: string;
  name: string;
  color: string;
  d: number;
  p: number;
  t: number;
  max: number;
  pill: { text: string; cls: string };
  note: string;
}) {
  const field = useDebounced((v) => saveDebrief(raceObj, { goal_notes: { [goalId]: v } }), note);
  return (
    <div className="db-goal">
      <div className="db-goal-top">
        <span className="dot" style={{ background: color }} />
        <span className="db-goal-name">{name}</span>
        <span className="mono db-nums">
          {fmtDur(d)} / {fmtDur(p)} / {fmtDur(t)}
        </span>
        <span className={`mono pill ${pill.cls}`}>{pill.text}</span>
      </div>
      <div className="db-bar">
        <div className="db-bar-plan" style={{ width: `${(p / max) * 100}%`, background: color }} />
        <div className="db-bar-did" style={{ width: `${(d / max) * 100}%`, background: color }} />
        <div className="db-bar-target" style={{ left: `${(t / max) * 100}%` }} />
      </div>
      <input className="input db-goal-note" placeholder={`Note on ${name} (optional)`} aria-label={`Note on ${name}`} {...field} />
    </div>
  );
}
