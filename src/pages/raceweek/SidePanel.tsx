import { useState } from 'react';
import { store, useDB } from '../../data/store';
import type { Goal, Lap, Race } from '../../data/types';
import { setGoalColor } from '../../domain/goals';
import { describeDays, endTime } from '../../domain/repeats';
import { setRaceTarget } from '../../domain/race';
import {
  activeGoals,
  goalOf,
  lapColor,
  lapIsRunning,
  lapPlacedStart,
  raceLabel,
  recordedMin,
  targetFor,
  timesOf,
} from '../../domain/selectors';
import { addMinutes, fmtDayTitle, fmtDur, hhmm } from '../../lib/time';
import { ColourPopover } from '../../ui/ColourPicker';
import { TargetStepper } from '../../ui/TargetStepper';
import { IconDoubleChevron, IconGrip, IconX } from '../../ui/icons';
import { showToast } from '../../ui/signals';
import type { Editor } from './editor';
import type { GridMode } from './WeekGrid';

export function SidePanel({
  mode,
  race,
  logRaceId,
  editor,
  nowMs,
  selected,
  onSelect,
  onFold,
  onTrayDown,
  onStartSession,
}: {
  mode: GridMode;
  race: Race;
  logRaceId: string;
  editor: Editor;
  nowMs: number;
  selected: Lap | null;
  onSelect: (id: string | null) => void;
  onFold: () => void;
  onTrayDown: (lap: Lap) => void;
  onStartSession: () => void;
}) {
  const db = useDB();
  const goals = activeGoals(db);
  const [colourFor, setColourFor] = useState<{ goal?: Goal; lap?: Lap; el: HTMLElement } | null>(null);
  const counted = editor.laps.filter((l) => l.status !== 'moved' && l.status !== 'dropped');
  const did = (gid: string) => editor.laps.filter((l) => l.goal_id === gid).reduce((s, l) => s + recordedMin(db, l.id, nowMs), 0);
  const planned = (gid: string) => counted.filter((l) => l.goal_id === gid && l.planned_start).reduce((s, l) => s + l.planned_min, 0);
  const tray = editor.laps.filter((l) => !l.planned_start && l.status === 'planned');
  const rules = mode === 'session' ? db.repeat_rules.filter((r) => !r.until_date || r.until_date >= new Date(race.starts_at).toISOString().slice(0, 10)) : [];
  const title = mode === 'session' ? `PLANNED FOR ${raceLabel(race)}` : 'GOALS THIS RACE';

  return (
    <aside id="iterace-side" className="rw-side glass" aria-label="Goals and laps">
      <div className="rw-side-head">
        <h2 className="mono">{title}</h2>
        <button className="icon-btn rw-fold" onClick={onFold} aria-label="Fold the goals panel to widen the calendar" title="Fold">
          <IconDoubleChevron dir="left" />
        </button>
      </div>
      <div className="rw-side-scroll no-scrollbar">
        {goals.map((g) => {
          const target = targetFor(db, race.id, g);
          const d = did(g.id);
          const pl = planned(g.id);
          const first = mode === 'session' ? pl : d;
          return (
            <div key={g.id} className="rw-goal">
              <div className="rw-goal-top">
                <button className="tl-colour" aria-label={`${g.name} colour. Change colour`} onClick={(e) => setColourFor({ goal: g, el: e.currentTarget })}>
                  <span className="dot goal-dot" style={{ background: g.color }} />
                </button>
                <span className="rw-goal-name">{g.name}</span>
                <span className="mono rw-goal-num">
                  {fmtDur(first)} / {fmtDur(target)}
                </span>
              </div>
              <div className="rw-bar">
                {mode !== 'driver' && mode !== 'session' && (
                  <div className="rw-bar-planned" style={{ width: `${Math.min(100, (pl / Math.max(1, target)) * 100)}%`, background: g.color }} />
                )}
                <div className="rw-bar-did" style={{ width: `${Math.min(100, (first / Math.max(1, target)) * 100)}%`, background: g.color }} />
              </div>
              {mode === 'mech' && <span className="label rw-planned">{fmtDur(pl).toUpperCase()} PLANNED THIS RACE</span>}
              {mode === 'session' && (
                <div className="rw-target">
                  <span className="label">TARGET FOR {raceLabel(race)}</span>
                  <TargetStepper
                    value={target}
                    min={0}
                    label={`Target for ${g.name}`}
                    onChange={(v) => {
                      const id = setRaceTarget(store, race.id, logRaceId, g.id, g.name, v);
                      showToast(`${g.name}: ${fmtDur(v)} for ${raceLabel(race).toLowerCase()}`, id);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {!goals.length && <p className="muted rw-empty">No active goals. Goals are added in the Mechanics session.</p>}

        {selected && <BlockDetails lap={selected} mode={mode} editor={editor} nowMs={nowMs} onClose={() => onSelect(null)} onColour={(el) => setColourFor({ lap: selected, el })} />}

        {rules.length > 0 && (
          <div className="rw-section">
            <h3 className="mono">REPEATING LAPS</h3>
            {rules.map((r) => (
              <div key={r.id} className="rw-rule">
                <span className="rw-rule-dot" style={{ background: goalOf(db, r.goal_id)?.color ?? '#8F8F97' }} />
                <div>
                  <span className="rw-rule-title">{r.title}</span>
                  <span className="mono rw-rule-when">
                    {describeDays(r.days)} · {r.start_time}–{endTime(r.start_time, r.length_min)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {mode !== 'driver' && (
          <div className="rw-section">
            <h3 className="mono">LAPS TO PLACE · {tray.length}</h3>
            {!tray.length && <p className="muted small">Laps you haven’t put on the grid wait here.</p>}
            {tray.map((l) => {
              const g = goalOf(db, l.goal_id);
              return (
                <div
                  key={l.id}
                  className="rw-tray"
                  data-chip="1"
                  style={{ ['--c' as string]: lapColor(db, l) }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    onTrayDown(l);
                  }}
                  title="Drag onto a day"
                >
                  <IconGrip />
                  <div>
                    <span className="mono rw-tray-sub">
                      {(g?.name ?? 'NO GOAL').toUpperCase()} · {fmtDur(l.planned_min).toUpperCase()}
                    </span>
                    <span className="rw-tray-title">{l.title}</span>
                  </div>
                  <button
                    className="icon-btn rw-tray-x"
                    data-x="1"
                    aria-label={`Delete ${l.title}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      const id = editor.remove(l.id);
                      if (editor.kind === 'live') showToast(`Deleted ${l.title}`, id);
                    }}
                  >
                    <IconX size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {mode === 'mech' && (
        <div className="rw-side-foot">
          <button className="btn btn-red" onClick={onStartSession}>
            START MECHANICS SESSION
          </button>
          <p className="label">ENDS {raceLabel(race)} AND OPENS THE REVIEW</p>
        </div>
      )}
      {colourFor && (
        <ColourPopover
          anchor={colourFor.el}
          title={colourFor.goal ? `${colourFor.goal.name.toUpperCase()} · COLOUR` : 'BLOCK COLOUR'}
          value={colourFor.goal?.color ?? (colourFor.lap ? lapColor(db, colourFor.lap) : null)}
          onPick={(hex) => {
            if (colourFor.goal) setGoalColor(store, colourFor.goal, hex);
            else if (colourFor.lap) {
              setLapColour(mode, editor, colourFor.lap.id, hex);
            }
          }}
          onClose={() => setColourFor(null)}
        />
      )}
    </aside>
  );
}

function BlockDetails({
  lap,
  mode,
  editor,
  nowMs,
  onClose,
  onColour,
}: {
  lap: Lap;
  mode: GridMode;
  editor: Editor;
  nowMs: number;
  onClose: () => void;
  onColour: (el: HTMLElement) => void;
}) {
  const db = useDB();
  const goal = goalOf(db, lap.goal_id);
  const times = timesOf(db, lap.id);
  const running = lapIsRunning(db, lap);
  const canEdit = mode !== 'driver' && !times.length && lap.status === 'planned';
  const start = lap.planned_start ? new Date(lap.planned_start) : null;
  const planLine = start ? `${fmtDayTitle(start)} · ${hhmm(start)}–${hhmm(addMinutes(start, lap.planned_min))}` : `Laps to place · ${fmtDur(lap.planned_min)}`;
  let didLine = '';
  if (running) didLine = `ON TRACK NOW · ${fmtDur(recordedMin(db, lap.id, nowMs))} SO FAR`;
  else if (lap.status === 'moved') didLine = 'MOVED TO LATER';
  else if (times.length) {
    const first = lapPlacedStart(db, lap)!;
    const last = times[times.length - 1];
    didLine = `DID ${hhmm(first)}–${hhmm(last.ended_at ?? nowMs)}${times.every((t) => t.how === 'by_hand') ? ' · BY HAND' : ''}`;
  }
  const colour = lapColor(db, lap);
  return (
    <div className="rw-detail">
      <div className="rw-detail-head">
        <span className="label">{(goal?.name ?? 'NO GOAL').toUpperCase()}</span>
        <button className="rw-detail-colour" aria-label="Change this block’s colour" title="Block colour" onClick={(e) => onColour(e.currentTarget)} style={{ background: colour }} />
        {lap.color && (
          <button
            className="btn btn-xs btn-soft"
            onClick={() => setLapColour(mode, editor, lap.id, null)}
          >
            USE GOAL COLOUR
          </button>
        )}
        <button className="icon-btn" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto' }}>
          <IconX />
        </button>
      </div>
      {canEdit ? (
        <input className="input rw-detail-title" aria-label="Lap name" defaultValue={lap.title} key={lap.id + 't'} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== lap.title && editor.update(lap.id, { title: e.target.value.trim() })} />
      ) : (
        <span className="rw-detail-title-text">{lap.title}</span>
      )}
      <span className="mono rw-detail-line">{planLine}</span>
      {didLine && <span className="mono rw-detail-line red-text">{didLine}</span>}
      {canEdit ? (
        <textarea
          className="textarea"
          rows={3}
          placeholder="Add a description"
          aria-label="Description"
          key={lap.id + 'd'}
          defaultValue={lap.description}
          onBlur={(e) => e.target.value !== lap.description && editor.update(lap.id, { description: e.target.value })}
        />
      ) : (
        <p className="rw-detail-desc">{lap.description || 'No description.'}</p>
      )}
      {canEdit && (
        <button
          className="btn btn-sm btn-outline-red"
          onClick={() => {
            const id = editor.remove(lap.id);
            if (editor.kind === 'live') showToast(`Removed “${lap.title}”`, id);
            onClose();
          }}
        >
          REMOVE FROM RACE
        </button>
      )}
    </div>
  );
}

/** Block colour: part of the draft in Mechanics mode (saved with SAVE), otherwise saved straight away. */
function setLapColour(mode: GridMode, editor: Editor, id: string, color: string | null) {
  if (mode === 'mech') {
    editor.update(id, { color });
    return;
  }
  const t = store.tx();
  t.update('laps', id, { color });
  t.commit();
}
