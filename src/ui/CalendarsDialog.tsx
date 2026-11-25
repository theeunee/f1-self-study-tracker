// Calendars: add or remove a read-only calendar by its private iCal link. The link goes straight to the
// Edge Function and is never kept in the browser.
import { useState } from 'react';
import { useDB } from '../data/store';
import { isLocalMode } from '../data/auth';
import { addCalendarSource, addSampleCalendar, removeCalendarSource } from '../domain/calendarSync';
import { Dialog } from './Dialog';
import { IconX } from './icons';

export function CalendarsDialog({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const [provider, setProvider] = useState<'google' | 'apple' | 'other'>('google');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const add = async () => {
    if (!url.trim()) return setError('Paste the private iCal link.');
    setBusy(true);
    const err = await addCalendarSource(provider, name.trim() || (provider === 'google' ? 'Google Calendar' : provider === 'apple' ? 'Apple Calendar' : 'Calendar'), url.trim());
    setBusy(false);
    if (err) return setError(err);
    setUrl('');
    setName('');
  };
  return (
    <Dialog label="Calendars" onClose={onClose} width={560}>
      <span className="label label-red">CALENDARS · READ-ONLY</span>
      <h2>Show your calendar on the grids</h2>
      <p>Events show dotted on Home and Race week. + adds one as a lap with no goal, × dismisses it.</p>
      <div className="cal-sources">
        {!db.calendar_sources.length && <p className="muted small">No calendars yet.</p>}
        {db.calendar_sources.map((s) => (
          <div key={s.id} className="cal-source">
            <span className="mono">{s.provider.toUpperCase()}</span>
            <span>{s.name}</span>
            <button className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => removeCalendarSource(s.id)}>
              <IconX />
            </button>
          </div>
        ))}
      </div>
      {isLocalMode ? (
        <>
          <p className="muted small">
            Local mode: calendar links need the Supabase project, because browsers can’t fetch private iCal links and the links must stay on the server.
          </p>
          {!db.calendar_sources.some((s) => s.name.startsWith('Sample')) && (
            <button className="btn btn-sm btn-outline" onClick={addSampleCalendar} style={{ alignSelf: 'flex-start' }}>
              ADD A SAMPLE CALENDAR
            </button>
          )}
        </>
      ) : (
        <div className="field">
          <div className="chips" role="group" aria-label="Provider">
            {(['google', 'apple', 'other'] as const).map((p) => (
              <button key={p} className="chip mono-chip" aria-pressed={provider === p} onClick={() => setProvider(p)}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Name (optional)" aria-label="Calendar name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input"
            placeholder={provider === 'google' ? 'Secret address in iCal format (Google Calendar → Settings)' : 'Public or private iCal link (webcal:// or https://)'}
            aria-label="iCal link"
            value={url}
            onChange={(e) => (setUrl(e.target.value), setError(''))}
          />
          <button className="btn btn-red" onClick={add} disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? 'CHECKING…' : 'ADD CALENDAR'}
          </button>
        </div>
      )}
      {error && <span className="error-text">{error}</span>}
      <div className="dialog-actions">
        <button className="btn btn-outline" onClick={onClose}>
          DONE
        </button>
      </div>
    </Dialog>
  );
}
