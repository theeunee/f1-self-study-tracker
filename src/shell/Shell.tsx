import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet } from 'react-router-dom';
import { store, useDB, useSaveError } from '../data/store';
import { deleteAccount, isLocalMode, loadSample, signOut } from '../data/auth';
import { tick } from '../domain/race';
import { driverRace, inSession, profileOf, raceLabel, sessionRace } from '../domain/selectors';
import { isTimeTravelling, nowMs, fmtDayTime } from '../lib/time';
import { createSignal, useEscape } from '../lib/hooks';
import { briefOpen, toastSignal } from '../ui/signals';
import { Background } from './Background';
import { Radio } from '../radio/Radio';
import { BriefOverlay } from '../session/Brief';
import { ConfirmDialog } from '../ui/Dialog';
import { CalendarsDialog } from '../ui/CalendarsDialog';
import { useCalendarSync } from '../domain/calendarSync';

/** Pages listen to this to jump back to today. */
export const todaySignal = createSignal(0);

/** Page-specific header buttons render into the header through this portal. */
export function HeaderActions({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.getElementById('header-slot')), []);
  return el ? createPortal(children, el) : null;
}

function Engine() {
  useCalendarSync();
  useEffect(() => {
    tick(store, nowMs());
    const id = setInterval(() => tick(store, nowMs()), 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}

export function Shell() {
  const db = useDB();
  const session = inSession(db);
  const race = driverRace(db);
  const ses = sessionRace(db);
  const saveError = useSaveError();

  useEffect(() => {
    document.documentElement.dataset.theme = session ? 'session' : 'light';
  }, [session]);

  return (
    <div className="app">
      <Engine />
      <Background raceNumber={ses ? ses.number : (race?.number ?? null)} />
      <header className="app-header">
        <div className="app-header-left">
          <span className="display wordmark">ITERACE</span>
          <nav aria-label="Pages" className="tabs">
            <NavLink to="/" end>
              HOME
            </NavLink>
            <NavLink to="/race-week">RACE WEEK</NavLink>
            <NavLink to="/goals">GOALS</NavLink>
          </nav>
        </div>
        <div className="app-header-right">
          {session ? (
            <>
              <span className="status-pill mono">
                <span className="status-dot live" />
                MECHANICS SESSION
              </span>
              <button className="btn btn-red" onClick={() => briefOpen.set(true)}>
                BRIEF &amp; START
              </button>
            </>
          ) : (
            race && (
              <span className="status-pill mono">
                <span className="status-dot" />
                {raceLabel(race)} · {race.status === 'live' ? 'ON TRACK' : `STARTS ${fmtDayTime(race.starts_at)}`}
              </span>
            )
          )}
          <div id="header-slot" className="header-slot" />
          <AccountMenu />
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <Radio />
      <TodayButton />
      <Toast />
      <BriefOverlay />
      {saveError && (
        <div className="save-error" role="alert">
          Couldn’t save the last change: {saveError}
        </div>
      )}
      {isTimeTravelling() && <div className="time-travel mono">DEV CLOCK</div>}
    </div>
  );
}

function TodayButton() {
  return (
    <button
      className="today-btn"
      aria-label="Jump to today"
      title="Jump to today"
      onClick={() => todaySignal.set((n) => n + 1)}
    >
      <span aria-hidden="true">📅</span>
    </button>
  );
}

function Toast() {
  const toast = toastSignal.use();
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => toastSignal.set((t) => (t && t.id === toast.id ? null : t)), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.logId && (
        <button
          className="btn btn-sm toast-undo"
          onClick={() => {
            const r = store.undo(toast.logId!);
            toastSignal.set(r.ok ? { id: toast.id + 1000, text: 'Undone.', logId: null } : { id: toast.id + 1000, text: r.reason, logId: null });
          }}
        >
          UNDO
        </button>
      )}
      <button className="toast-x" aria-label="Dismiss" onClick={() => toastSignal.set(null)}>
        ×
      </button>
    </div>
  );
}

function AccountMenu() {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'sample' | 'calendars' | null>(null);
  useEscape(open ? () => setOpen(false) : null);
  const name = profileOf(db)?.display_name ?? '';
  return (
    <div className="account">
      <button
        className="account-btn"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {(name[0] ?? '?').toUpperCase()}
      </button>
      {open && (
        <div className="popover account-pop" role="dialog" aria-label="Account">
          <strong>{name}</strong>
          <span className="label">{isLocalMode ? 'Local mode · this browser only' : 'Signed in'}</span>
          <button className="btn btn-sm btn-outline" onClick={() => (setConfirm('calendars'), setOpen(false))}>
            CALENDARS
          </button>
          {isLocalMode && (
            <button className="btn btn-sm btn-outline" onClick={() => setConfirm('sample')}>
              LOAD SAMPLE DATA
            </button>
          )}
          {!isLocalMode && (
            <button className="btn btn-sm btn-outline" onClick={() => signOut()}>
              SIGN OUT
            </button>
          )}
          <button className="btn btn-sm btn-outline-red" onClick={() => setConfirm('delete')}>
            DELETE ACCOUNT
          </button>
        </div>
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          kicker="DELETE ACCOUNT"
          title="Delete your account and everything in it?"
          body="Every goal, race, lap and note is removed for good. This can’t be undone."
          confirmLabel="DELETE EVERYTHING"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => deleteAccount()}
        />
      )}
      {confirm === 'calendars' && <CalendarsDialog onClose={() => setConfirm(null)} />}
      {confirm === 'sample' && (
        <ConfirmDialog
          kicker="SAMPLE DATA"
          title="Replace everything with the sample race?"
          body="Your local data in this browser is replaced with sample goals and a live Race 04."
          confirmLabel="LOAD SAMPLE"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            loadSample(name);
            setConfirm(null);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
