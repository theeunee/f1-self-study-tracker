// D-day countdown (brief §4): the Mechanics session by default, or a custom date such as an exam.
// The session countdown is built in and can't be removed. Shared by Home and Race week, so they stay in sync.
import { useState } from 'react';
import { store, useDB } from '../data/store';
import type { DB } from '../data/types';
import { driverRace } from '../domain/selectors';
import { useNow } from '../lib/hooks';
import { atTime, dayKey, fmtCountdown, fmtDateShort, fmtDayTime, now } from '../lib/time';
import { useEscape } from '../lib/hooks';
import { IconEdit, IconX } from './icons';

export function countdownTarget(db: DB): { label: string; at: Date | null; isSession: boolean } {
  const sel = db.countdowns.find((c) => c.selected);
  if (sel) {
    const at = atTime(sel.date, sel.time ?? '00:00');
    return { label: `TO ${sel.name.toUpperCase()} · ${fmtDateShort(sel.date)}${sel.time ? ` ${sel.time}` : ''}`, at, isSession: false };
  }
  const r = driverRace(db);
  if (!r || r.status === 'done') return { label: 'TO YOUR MECHANICS SESSION', at: null, isSession: true };
  if (r.status === 'in_session') return { label: 'MECHANICS SESSION NOW', at: null, isSession: true };
  return { label: `TO YOUR MECHANICS SESSION · ${fmtDayTime(r.session_at)}`, at: new Date(r.session_at), isSession: true };
}

function select(id: string | null) {
  const t = store.tx();
  for (const c of t.db.countdowns) if (c.selected !== (c.id === id)) t.update('countdowns', c.id, { selected: c.id === id });
  t.commit();
}

export function DDay({ variant }: { variant: 'banner' | 'bar' }) {
  const db = useDB();
  const nowD = useNow(1000);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  useEscape(open ? () => setOpen(false) : null);
  const target = countdownTarget(db);
  const text = target.at ? fmtCountdown(target.at.getTime() - nowD.getTime()) : '';
  const add = () => {
    if (!name.trim()) return setError('Give it a name.');
    if (!date || date < dayKey(now())) return setError('Pick a date from today on.');
    const t = store.tx();
    for (const c of t.db.countdowns) if (c.selected) t.update('countdowns', c.id, { selected: false });
    t.insert('countdowns', { name: name.trim(), date, time: time || null, selected: true });
    t.commit();
    setName('');
    setDate('');
    setTime('');
    setError('');
  };
  const sessionChecked = !db.countdowns.some((c) => c.selected);
  const r = driverRace(db);
  return (
    <div className={`dday dday-${variant}`} data-dday="1">
      {variant === 'banner' ? (
        <>
          <div className="dday-top">
            <span role="timer" aria-label={`${text} ${target.label}`} className="display dday-num">
              {text || 'NOW'}
            </span>
            <button className="dday-edit mono" aria-label="Change the countdown" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <IconEdit /> EDIT
            </button>
          </div>
          <span className="dday-label mono">{target.label}</span>
        </>
      ) : (
        <>
          <span role="timer" className="dday-inline mono">
            {text} {target.label}
          </span>
          <button className="dday-edit mono" aria-label="Change the countdown" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <IconEdit /> EDIT
          </button>
        </>
      )}
      {open && (
        <div className="popover dday-pop" role="dialog" aria-label="Countdowns">
          <span className="label label-red">COUNT DOWN TO</span>
          <div role="radiogroup" aria-label="Countdown" className="dday-list">
            <button role="radio" aria-checked={sessionChecked} className="dday-opt" onClick={() => select(null)}>
              <span className="dday-radio" />
              <span>
                <strong>Mechanics session</strong>
                <span className="mono small">{r && r.status !== 'done' ? fmtDayTime(r.session_at) : 'every race'}</span>
              </span>
            </button>
            {db.countdowns.map((c) => (
              <div key={c.id} className="dday-row">
                <button role="radio" aria-checked={c.selected} className="dday-opt" onClick={() => select(c.id)}>
                  <span className="dday-radio" />
                  <span>
                    <strong>{c.name}</strong>
                    <span className="mono small">
                      {fmtDateShort(c.date)}
                      {c.time ? ` ${c.time}` : ''}
                    </span>
                  </span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => {
                    const t = store.tx();
                    t.remove('countdowns', c.id);
                    t.commit();
                  }}
                >
                  <IconX />
                </button>
              </div>
            ))}
          </div>
          <div className="dday-add">
            <span className="label">ADD A D-DAY</span>
            <input className="input" placeholder="e.g. JLPT exam, Vacation" aria-label="D-day name" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="dday-add-row">
              <input type="date" className="input mono-input" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="time" className="input mono-input" aria-label="Time, optional" value={time} onChange={(e) => setTime(e.target.value)} />
              <button className="btn btn-sm btn-red" onClick={add}>
                ADD
              </button>
            </div>
            {error && <span className="error-text">{error}</span>}
          </div>
          <button className="btn btn-sm btn-outline" style={{ alignSelf: 'flex-end' }} onClick={() => setOpen(false)}>
            DONE
          </button>
        </div>
      )}
    </div>
  );
}
