import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { store, useDB } from '../../data/store';
import type { Lap } from '../../data/types';
import { keepGhost, repeatGhosts, skipGhost, createRepeatRule, type Ghost } from '../../domain/repeats';
import { lapsLeftAfter, moveSessionEarlier, startSessionNow } from '../../domain/race';
import { addCalendarEvent, calendarEvents, calendarGhosts, dismissCalendarEvent } from '../../domain/calendar';
import {
  activeGoals,
  driverRace,
  lapPlacedStart,
  lapsOf,
  liveRace,
  nextRaceAfter,
  raceDays,
  raceLabel,
  raceWeekStart,
  sessionRace,
} from '../../domain/selectors';
import { useNowMs, usePref } from '../../lib/hooks';
import { MIN, addDays, dayKey, fmtDayTime, fmtDayShort, fmtWeekRange, hhmmToMinutes, minutesToHHMM, startOfWeek } from '../../lib/time';
import { HeaderActions, todaySignal } from '../../shell/Shell';
import { ConfirmDialog, Dialog } from '../../ui/Dialog';
import { DDay } from '../../ui/DDay';
import { LogTimeDialog } from '../../ui/LogTimeDialog';
import { IconDoubleChevron, IconPlus, IconSwap } from '../../ui/icons';
import { draftSignal, showToast } from '../../ui/signals';
import { liveEditor, useDraftEditor } from './editor';
import { NewLapDialog, lapStartFrom } from './NewLapDialog';
import { SidePanel } from './SidePanel';
import { WeekGrid, type CalGhost, type GridMode } from './WeekGrid';
import { UnfinishedLaps, unfinishedLaps, carryChoiceFor } from '../../session/Unfinished';
import { Link } from 'react-router-dom';
import { pieStyle } from './pie';
import './raceweek.css';

export function RaceWeekPage() {
  const db = useDB();
  const nowMs = useNowMs(15000);
  const ses = sessionRace(db);
  const live = liveRace(db);
  const planRace = ses ? nextRaceAfter(db, ses) : undefined;
  const race = planRace ?? driverRace(db);

  const [mechOn, setMechOn] = useState(false);
  const mode: GridMode = ses ? 'session' : mechOn && live ? 'mech' : 'driver';
  const [range, setRange] = usePref<'race' | 'scroll'>('week.range', 'race');
  const [folded, setFolded] = usePref('week.folded', false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newLap, setNewLap] = useState<{ day: string | 'tray'; start: string; end: string } | null>(null);
  const [record, setRecord] = useState<Lap | null>(null);
  const [savePrompt, setSavePrompt] = useState<(() => void) | null>(null);
  const [askSession, setAskSession] = useState(false);
  const [moveAsk, setMoveAsk] = useState<Date | null>(null);
  const [trayDrag, setTrayDrag] = useState<Lap | null>(null);
  const [unfOpen, setUnfOpen] = useState(true);
  const [scrollSpan, setScrollSpan] = useState({ before: 14, after: 21 });
  const todayTick = todaySignal.use();
  const calEvents = calendarEvents.use();

  const baseLaps = useMemo(() => lapsOf(db, race?.id), [db, race?.id]);
  const draft = useDraftEditor(race, baseLaps, mode === 'mech');
  const editor = mode === 'session' ? liveEditor(race, ses?.id, baseLaps) : draft;

  // Unsaved Mechanics-mode changes show in the radio with a SAVE button.
  useEffect(() => {
    draftSignal.set(mode === 'mech' && draft.dirty ? { count: draft.changes.length, lines: draft.changes.map((c) => `${c.main} · ${c.detail}`), save: () => draft.save() } : null);
    return () => draftSignal.set(null);
  }, [mode, draft.dirty, draft.changes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the page or the tab with unsaved changes asks first.
  const blocker = useBlocker(mode === 'mech' && draft.dirty);
  useEffect(() => {
    if (blocker.state === 'blocked') setSavePrompt(() => () => blocker.proceed());
  }, [blocker.state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!(mode === 'mech' && draft.dirty)) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [mode, draft.dirty]);
  useEffect(() => {
    if (todayTick && range === 'scroll') setScrollSpan({ before: 14, after: 21 });
  }, [todayTick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!race) return <div className="page-placeholder glass">No race yet.</div>;

  const scrollMode = mode === 'driver' && range === 'scroll';
  const days = scrollMode
    ? Array.from({ length: scrollSpan.before + scrollSpan.after }, (_, i) => addDays(startOfWeek(nowMs), i - scrollSpan.before))
    : raceDays(race);
  const daysKeys = days.map(dayKey);

  // Laps on the grid.
  let laps: Lap[];
  if (scrollMode) {
    const set = new Set(daysKeys);
    laps = db.laps.filter((l) => {
      const s = lapPlacedStart(db, l);
      return s && set.has(dayKey(s));
    });
  } else laps = editor.laps;

  const ghosts: (Ghost | CalGhost)[] = [...repeatGhosts(db, race), ...calendarGhosts(db, calEvents, days)];
  const lockedBefore = mode === 'mech' ? Math.ceil(nowMs / (15 * MIN)) * 15 * MIN : mode === 'session' ? nowMs : 0;
  const sessionAt = race.status === 'done' ? null : new Date(race.session_at);
  const selected = laps.find((l) => l.id === selectedId) ?? null;
  const firstDay = raceWeekStart(race);

  const switchMode = () => {
    if (mode === 'mech' && draft.dirty) setSavePrompt(() => () => setMechOn(false));
    else setMechOn(!mechOn);
    setSelectedId(null);
  };

  const remainingDays = (() => {
    if (mode === 'session') return raceDays(race).map(dayKey);
    const t = dayKey(nowMs);
    const end = sessionAt ? dayKey(sessionAt) : daysKeys[6];
    return raceDays(race).map(dayKey).filter((k) => k >= t && k <= end);
  })();
  const earliest = (k: string) => {
    if (mode !== 'mech' || k !== dayKey(nowMs)) return 0;
    return Math.ceil((nowMs - new Date(`${k}T00:00`).getTime()) / MIN / 15) * 15;
  };

  const unfinished = ses ? unfinishedLaps(db, ses, nowMs) : [];
  const unfLeft = unfinished.filter((l) => !carryChoiceFor(db, ses!, l.id)).length;
  const showUnf = mode === 'session' && unfOpen;

  // Page bar text.
  const title = mode === 'session' ? `PLAN ${raceLabel(race)}` : mode === 'mech' ? `EDIT ${raceLabel(race)}` : 'RACE WEEK';
  const dates = scrollMode ? 'SCROLLING DAYS' : fmtWeekRange(firstDay);

  return (
    <div className="rw-page">
      <HeaderActions>
        {!ses && live && (
          <button className={`btn mode-btn ${mode === 'mech' ? 'btn-solid' : 'btn-white'}`} onClick={switchMode} aria-label={mode === 'mech' ? 'Mechanics mode is on. Switch to Driver mode' : 'Driver mode is on. Switch to Mechanics mode'}>
            {mode === 'mech' ? 'MECHANICS MODE' : 'DRIVER MODE'} <IconSwap />
          </button>
        )}
      </HeaderActions>
      <section className="page-bar" aria-label="Race summary">
        <h1 className="page-title">{title}</h1>
        <span className="page-sub">{dates}</span>
        {mode === 'driver' && <DDay variant="bar" />}
        {mode === 'mech' && <span className="page-sub red-text">PAST HOURS ARE LOCKED</span>}
        {mode === 'session' && <span className="page-sub red-text">DOTTED = NOT KEPT YET</span>}
        <div className="page-bar-right">
          {mode === 'mech' && (
            <>
              <span className={`label${draft.dirty ? ' label-red' : ''}`}>
                {draft.dirty ? `${draft.changes.length} UNSAVED CHANGE${draft.changes.length === 1 ? '' : 'S'}` : 'ALL SAVED'}
              </span>
              <button
                className={`btn ${draft.dirty ? 'btn-red' : 'btn-soft'}`}
                aria-disabled={!draft.dirty}
                onClick={() => {
                  if (!draft.dirty) return;
                  const n = draft.changes.length;
                  draft.save();
                  showToast(`Saved ${n} change${n === 1 ? '' : 's'} to the race log`);
                }}
              >
                SAVE
              </button>
            </>
          )}
          {mode === 'session' && (
            <>
              <button className="btn btn-outline" onClick={() => setUnfOpen(true)}>
                UNFINISHED LAPS · {unfLeft} LEFT
              </button>
              <Link className="btn btn-outline" to="/goals">
                EDIT GOALS
              </Link>
            </>
          )}
          {mode !== 'driver' && (
            <button className="btn btn-red" onClick={() => setNewLap({ day: 'tray', start: '09:00', end: '10:00' })}>
              <IconPlus /> NEW LAP
            </button>
          )}
          {mode === 'driver' && (
            <div className="seg" role="group" aria-label="How many days to show">
              <button aria-pressed={range === 'race'} onClick={() => setRange('race')}>
                THIS RACE
              </button>
              <button aria-pressed={range === 'scroll'} onClick={() => setRange('scroll')}>
                SCROLL DAYS
              </button>
            </div>
          )}
        </div>
      </section>

      <div className={`rw-body${folded ? ' folded' : ''}`}>
        {folded ? (
          <div className="rw-pies glass" role="group" aria-label="Goals">
            <button className="icon-btn" onClick={() => setFolded(false)} aria-label="Show the goals panel" title="Unfold">
              <IconDoubleChevron dir="right" />
            </button>
            {activeGoals(db).map((g) => (
              <button key={g.id} className="rw-pie" style={pieStyle(db, race, g, nowMs, mode)} onClick={() => setFolded(false)} aria-label={`${g.name}. Show the goals panel`} title={g.name} />
            ))}
          </div>
        ) : (
          <SidePanel
            mode={mode}
            race={race}
            logRaceId={ses?.id ?? race.id}
            editor={editor}
            nowMs={nowMs}
            selected={selected}
            onSelect={setSelectedId}
            onFold={() => setFolded(true)}
            onTrayDown={(l) => setTrayDrag(l)}
            onStartSession={() => (draft.dirty ? setSavePrompt(() => () => setAskSession(true)) : setAskSession(true))}
          />
        )}
        {showUnf && ses ? (
          <UnfinishedLaps ended={ses} next={race} onClose={() => setUnfOpen(false)} />
        ) : (
          <WeekGrid
            days={days}
            mode={scrollMode ? 'driver' : mode}
            laps={laps}
            ghosts={ghosts}
            raceTag={{ day: dayKey(firstDay), label: raceLabel(race) }}
            sessionAt={sessionAt}
            sessionDraggable={mode === 'mech'}
            nowMs={nowMs}
            lockedBefore={lockedBefore}
            selectedId={selectedId}
            dayWidth={scrollMode ? 142 : null}
            trayDrag={trayDrag}
            scrollKey={(scrollMode ? 1 : 0) + todayTick * 2}
            onSelect={setSelectedId}
            onCreate={(day, s, e) => setNewLap({ day, start: minutesToHHMM(s), end: minutesToHHMM(e ?? s + 60) })}
            onMove={(lap, start, min) => {
              const id = editor.update(lap.id, { planned_start: start.toISOString(), planned_min: min });
              if (editor.kind === 'live') showToast(`Moved ${lap.title} · ${fmtDayTime(start)}`, id);
            }}
            onDropTray={(lap, start) => {
              const id = editor.update(lap.id, { planned_start: start.toISOString() });
              if (editor.kind === 'live') showToast(`Placed ${lap.title} · ${fmtDayTime(start)}`, id);
            }}
            onTrayDragEnd={() => setTrayDrag(null)}
            onRecord={(lap) => setRecord(lap)}
            onKeep={(g) => {
              const id = g.kind === 'repeat' ? keepGhost(store, race, g) : addCalendarEvent(store, race, g, 'week');
              showToast(`${g.kind === 'repeat' ? 'Kept' : 'Added'} ${g.title}`, id);
            }}
            onSkip={(g) => {
              const id = g.kind === 'repeat' ? skipGhost(store, race, g) : dismissCalendarEvent(store, race, g, 'week');
              showToast(`${g.kind === 'repeat' ? 'Skipped' : 'Dismissed'} ${g.title}`, id);
            }}
            onSessionDrag={(to) => {
              if (!sessionAt) return;
              if (to.getTime() >= sessionAt.getTime()) return showToast('The session can only move earlier.');
              if (to.getTime() <= nowMs) return showToast('Pick a time later than now, or use START MECHANICS SESSION.');
              setMoveAsk(to);
            }}
            onEdge={(side) => setScrollSpan((s) => (side === 'left' ? { ...s, before: s.before + 14 } : { ...s, after: s.after + 14 }))}
          />
        )}
      </div>

      {newLap && (
        <NewLapDialog
          heading={`NEW LAP · ${raceLabel(race)}`}
          days={remainingDays}
          allowRepeat={mode === 'session'}
          earliest={earliest}
          init={newLap}
          onClose={() => setNewLap(null)}
          onAdd={(r) => {
            if (r.repeat) {
              const id = createRepeatRule(store, race, { title: r.title, goal_id: r.goal_id, days: r.repeat, start_time: r.start, length_min: r.min });
              showToast(`Added repeating lap ${r.title}`, id);
              return;
            }
            const id = editor.add({ title: r.title, goal_id: r.goal_id, planned_start: lapStartFrom(r), planned_min: r.min, description: '' });
            if (editor.kind === 'live') showToast(`Added ${r.title}`, id);
          }}
        />
      )}
      {record && (
        <LogTimeDialog lap={record} variant="record" day={dayKey(record.planned_start ?? nowMs)} onClose={() => setRecord(null)} />
      )}
      {savePrompt && (
        <Dialog label="Save your changes?" onClose={() => setSavePrompt(null)} width={540}>
          <h2>Save your changes to {raceLabel(race).replace('RACE', 'Race')}?</h2>
          <p>Saving puts these in this race’s log. Discarding puts everything back the way it was.</p>
          <ul className="rw-changes">
            {draft.changes.map((c) => (
              <li key={c.id}>
                {c.main} · {c.detail}
              </li>
            ))}
          </ul>
          <div className="dialog-actions">
            <button
              className="btn btn-outline"
              onClick={() => {
                draft.discard();
                const next = savePrompt;
                setSavePrompt(null);
                setTimeout(next, 0);
              }}
            >
              DISCARD
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                if (blocker.state === 'blocked') blocker.reset();
                setSavePrompt(null);
              }}
            >
              KEEP EDITING
            </button>
            <button
              className="btn btn-red"
              onClick={() => {
                draft.save();
                const next = savePrompt;
                setSavePrompt(null);
                setTimeout(next, 0);
              }}
            >
              SAVE
            </button>
          </div>
        </Dialog>
      )}
      {askSession && (
        <ConfirmDialog
          kicker="MECHANICS SESSION"
          title={`End ${raceLabel(race).replace('RACE', 'Race')} and start the Mechanics session?`}
          body={`You’ll review this race, then plan the next one. ${raceLabel(race).replace('RACE', 'Race')} can’t be driven after this.`}
          cancelLabel="KEEP DRIVING"
          confirmLabel="START SESSION"
          danger
          onCancel={() => setAskSession(false)}
          onConfirm={() => {
            setAskSession(false);
            setMechOn(false);
            startSessionNow(store, 'week');
          }}
        />
      )}
      {moveAsk && sessionAt && (
        <ConfirmDialog
          kicker="MOVE THE MECHANICS SESSION?"
          title={`${fmtDayTime(sessionAt)} → ${fmtDayTime(moveAsk)}`}
          body={(() => {
            const n = live ? lapsLeftAfter(store, live, moveAsk) : 0;
            return `${raceLabel(race).replace('RACE', 'Race')} ends when the session starts. ${n ? `${n} lap${n === 1 ? ' planned after that goes' : 's planned after that go'} to the debrief as unfinished. ` : ''}The move is noted in the race log.`;
          })()}
          cancelLabel="KEEP IT"
          confirmLabel="MOVE SESSION"
          onCancel={() => setMoveAsk(null)}
          onConfirm={() => {
            const r = moveSessionEarlier(store, moveAsk, 'week');
            if (r.ok) showToast(`Mechanics session moved to ${fmtDayTime(moveAsk)}`, r.logId);
            else showToast(r.reason);
            setMoveAsk(null);
          }}
        />
      )}
    </div>
  );
}

// Re-exported for Home's MOVE TO LATER day labels.
export const dayChipLabel = (k: string) => fmtDayShort(new Date(`${k}T00:00`));
export const toMin = hhmmToMinutes;
