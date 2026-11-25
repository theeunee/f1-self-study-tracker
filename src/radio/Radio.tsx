// Team Radio (brief §4, §5 Radio log, §6 Mechanics session): 📻 bottom-left on every page.
// Hover for a Race Engineer line; click for this race's log (newest first, grouped by day; today's
// entries can be undone; any entry can have a note). In the session it opens by itself and shows the
// checklist above the log. EMERGENCY PIT STOP brings the session earlier or starts it now.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { store, useDB } from '../data/store';
import type { LogEntry } from '../data/types';
import { driverRace, inSession, liveRace, nextRaceAfter, raceLabel, sessionRace, activeGoals, countedLaps, targetFor } from '../domain/selectors';
import { useEscape, useNowMs } from '../lib/hooks';
import { dayKey, fmtDayShort, fmtDayTime, fmtDur, hhmm, MONTH_SHORT } from '../lib/time';
import { briefOpen, draftSignal, pitStopOpen, radioOpen, showToast } from '../ui/signals';
import { IconCheck, IconX } from '../ui/icons';
import { engineerLines, type RadioPage } from './lines';
import { PitStop } from './PitStop';
import { unfinishedLaps, carryChoiceFor } from '../session/Unfinished';
import './radio.css';

const PAGE_LABEL: Record<string, string> = { home: 'HOME', week: 'RACE WEEK', goals: 'GOALS', session: 'MECHANICS SESSION' };

export function Radio() {
  const db = useDB();
  const nowMs = useNowMs(30000);
  const open = radioOpen.use();
  const pit = pitStopOpen.use();
  const loc = useLocation();
  const page: RadioPage = loc.pathname.startsWith('/race-week') ? 'week' : loc.pathname.startsWith('/goals') ? 'goals' : 'home';
  const session = inSession(db);
  const draft = draftSignal.use();
  const [hover, setHover] = useState(false);
  const [count, setCount] = useState(0);

  // In the session the radio opens by itself on every page.
  const sesId = sessionRace(db)?.id;
  useEffect(() => {
    if (sesId) radioOpen.set(true);
  }, [sesId, loc.pathname]);

  const lines = engineerLines(db, page, nowMs, !!draft);
  const line = lines[(Math.max(1, count) - 1) % lines.length];

  return (
    <>
      <button
        className="radio-btn"
        aria-label="Team Radio. Open this race’s log"
        aria-expanded={open}
        onMouseEnter={() => {
          setHover(true);
          setCount((c) => c + 1);
        }}
        onMouseLeave={() => setHover(false)}
        onFocus={() => {
          setHover(true);
          setCount((c) => c + 1);
        }}
        onBlur={() => setHover(false)}
        onClick={() => {
          radioOpen.set(!open);
          setHover(false);
        }}
      >
        <span aria-hidden="true">📻</span>
      </button>
      {hover && !open && (
        <div className="radio-bubble" role="status">
          <span className="mono radio-bubble-kicker">
            <span className="status-dot live" /> RACE ENGINEER
          </span>
          <p>{line}</p>
          <span className="mono radio-bubble-foot">CLICK FOR THIS RACE’S LOG</span>
        </div>
      )}
      {open && <RadioLog session={session} page={page} />}
      {pit && <PitStop onClose={() => pitStopOpen.set(false)} />}
    </>
  );
}

function RadioLog({ session, page }: { session: boolean; page: RadioPage }) {
  const db = useDB();
  const nowMs = useNowMs(30000);
  const draft = draftSignal.use();
  const [help, setHelp] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  useEscape(() => radioOpen.set(false));
  const ses = sessionRace(db);
  const race = ses ?? driverRace(db);
  const live = liveRace(db);
  const today = dayKey(nowMs);

  const entries = useMemo(
    () =>
      db.log_entries
        .filter((e) => e.race_id === race?.id && !e.undone)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [db.log_entries, race?.id],
  );
  const days = useMemo(() => {
    const m = new Map<string, LogEntry[]>();
    for (const e of entries) {
      const k = dayKey(e.created_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.entries()];
  }, [entries]);

  const saveNote = (e: LogEntry) => {
    const t = store.tx();
    t.update('log_entries', e.id, { note: text.trim() });
    t.commit();
    setEditing(null);
  };

  return (
    <div className="radio-pop" role="dialog" aria-labelledby="radio-log-h">
      <div className="radio-head">
        <span className="status-dot live" />
        <h2 id="radio-log-h" className="mono">
          {session ? 'PIT WALL · MECHANICS SESSION' : `TEAM RADIO · ${raceLabel(race)} LOG`}
        </h2>
        <span className="radio-help-wrap">
          <button
            className="radio-help"
            aria-label="What is the race log?"
            aria-describedby="radio-log-help"
            onMouseEnter={() => setHelp(true)}
            onMouseLeave={() => setHelp(false)}
            onFocus={() => setHelp(true)}
            onBlur={() => setHelp(false)}
          >
            ?
          </button>
          {help && (
            <p id="radio-log-help" role="tooltip" className="radio-tip">
              Every change this race. Today’s can be undone; earlier days are read-only. Add a note to anything you want to bring up in the Mechanics session.
            </p>
          )}
        </span>
        <button className="icon-btn radio-x" aria-label="Close the race log" onClick={() => radioOpen.set(false)}>
          <IconX />
        </button>
      </div>
      {session && ses && <Checklist page={page} />}
      <div className="radio-list no-scrollbar">
        {draft && (
          <div className="radio-pending">
            <div className="radio-pending-head">
              <span className="mono red-text">
                {draft.count} UNSAVED CHANGE{draft.count === 1 ? '' : 'S'} · RACE WEEK
              </span>
              <button className="btn btn-xs btn-red" onClick={() => draft.save()}>
                SAVE
              </button>
            </div>
            {draft.lines.map((l, i) => (
              <span key={i} className="radio-pending-line">
                {l}
              </span>
            ))}
          </div>
        )}
        {!entries.length && !draft && <p className="muted radio-empty">No changes logged yet this race.</p>}
        {days.map(([k, list]) => {
          const d = new Date(`${k}T00:00`);
          return (
            <div key={k} className="radio-day">
              <div className="mono radio-day-title">
                {fmtDayShort(d)} {MONTH_SHORT[d.getMonth()]}
              </div>
              {list.map((e) => {
                const canUndo = k === today && !!e.payload?.ops?.length;
                return (
                  <div key={e.id} className="radio-entry">
                    <div className="radio-entry-row">
                      <span className="mono radio-time">{hhmm(e.created_at)}</span>
                      <span className="radio-entry-text">
                        <strong>{e.main}</strong>
                        {e.detail && <span className="radio-detail">{e.detail}</span>}
                        <span className="mono radio-where">{PAGE_LABEL[e.page] ?? e.page.toUpperCase()}</span>
                      </span>
                      {canUndo && (
                        <button
                          className="btn btn-xs btn-soft radio-undo"
                          aria-label={`Undo: ${e.main}`}
                          onClick={() => {
                            const r = store.undo(e.id);
                            showToast(r.ok ? `Undone: ${e.main}` : r.reason);
                          }}
                        >
                          UNDO
                        </button>
                      )}
                    </div>
                    {e.note && editing !== e.id && <p className="radio-note">{e.note}</p>}
                    {editing === e.id ? (
                      <div className="radio-note-edit">
                        <input
                          className="input"
                          autoFocus
                          placeholder="e.g. couldn’t focus, short on sleep"
                          aria-label="Note for the Mechanics session"
                          value={text}
                          onChange={(ev) => setText(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter') saveNote(e);
                            if (ev.key === 'Escape') {
                              ev.stopPropagation();
                              setEditing(null);
                            }
                          }}
                        />
                        <button className="btn btn-xs btn-solid" onClick={() => saveNote(e)}>
                          SAVE
                        </button>
                      </div>
                    ) : (
                      <button
                        className="radio-note-btn mono"
                        onClick={() => {
                          setEditing(e.id);
                          setText(e.note);
                        }}
                      >
                        {e.note ? 'EDIT NOTE' : 'ADD NOTE'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="radio-foot">
        <span className="mono">
          {session ? `MECHANICS SESSION · ${fmtDayTime(ses!.ended_at ?? ses!.session_at)}` : race && race.status !== 'done' ? `MECHANICS SESSION · ${fmtDayTime(race.session_at)}` : ''}
        </span>
        {live && !session && (
          <button className="btn btn-xs btn-outline-red" onClick={() => pitStopOpen.set(true)}>
            EMERGENCY PIT STOP
          </button>
        )}
      </div>
    </div>
  );
}

/** The session checklist, done in any order (brief §6 Mechanics session). */
function Checklist({ page }: { page: RadioPage }) {
  const db = useDB();
  const nowMs = useNowMs(30000);
  const nav = useNavigate();
  const brief = briefOpen.use();
  const ses = sessionRace(db)!;
  const next = nextRaceAfter(db, ses);
  const checks = db.session_checks.find((c) => c.race_id === ses.id);
  const unf = unfinishedLaps(db, ses, nowMs);
  const left = unf.filter((l) => !carryChoiceFor(db, ses, l.id)).length;
  const planned = countedLaps(db, next?.id).filter((l) => l.planned_start).reduce((s, l) => s + l.planned_min, 0);
  const targets = activeGoals(db).reduce((s, g) => s + targetFor(db, next?.id, g), 0);
  const items = [
    { k: 'debrief' as const, label: 'Debrief', sub: `Review ${raceLabel(ses).replace('RACE', 'Race')} and write notes`, here: page === 'home' && !brief, act: 'GO', go: () => nav('/') },
    { k: 'unfinished' as const, label: 'Unfinished laps', sub: unf.length ? (left ? `${left} still to carry or drop` : 'Every lap decided') : 'Every lap was finished', here: page === 'week' && !brief, act: 'GO', go: () => nav('/race-week') },
    { k: 'plan' as const, label: `Plan ${raceLabel(next).replace('RACE', 'Race')}`, sub: `${fmtDur(planned)} planned of ${fmtDur(targets)} in targets`, here: false, act: 'GO', go: () => nav('/race-week') },
    { k: 'brief' as const, label: 'Brief & start', sub: 'Focus, subgoals and the start time', here: brief, act: 'OPEN', go: () => briefOpen.set(true) },
  ];
  const nDone = items.filter((it) => checks?.[it.k]).length;
  const toggle = (k: (typeof items)[number]['k']) => {
    const t = store.tx();
    if (checks) t.update('session_checks', checks.id, { [k]: !checks[k] });
    else t.insert('session_checks', { race_id: ses.id, debrief: false, unfinished: false, plan: false, brief: false, [k]: true });
    t.commit();
  };
  return (
    <div className="radio-check">
      <div className="radio-check-head mono">
        <span className="red-text">CHECKLIST · ANY ORDER</span>
        <span>
          {nDone} OF {items.length} DONE
        </span>
      </div>
      {items.map((it) => (
        <div key={it.k} className="radio-check-row">
          <button role="checkbox" aria-checked={!!checks?.[it.k]} aria-label={`${it.label}: ${checks?.[it.k] ? 'done' : 'not done'}`} className={`radio-tick${checks?.[it.k] ? ' on' : ''}`} onClick={() => toggle(it.k)}>
            {checks?.[it.k] && <IconCheck size={12} />}
          </button>
          <span className="radio-check-text">
            <span className="radio-check-label">
              <span className={checks?.[it.k] ? 'struck' : ''}>{it.label}</span>
              {it.here && <span className="mono here">YOU’RE HERE</span>}
            </span>
            <span className="radio-check-sub">{it.sub}</span>
          </span>
          <button className="btn btn-xs btn-outline radio-go" aria-label={`${it.act === 'GO' ? 'Go to' : 'Open'} ${it.label}`} onClick={it.go}>
            {it.act}
            {it.act === 'GO' ? ' →' : ''}
          </button>
        </div>
      ))}
    </div>
  );
}

