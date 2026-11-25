// Client side of calendar sync. With Supabase: asks the `calendar` Edge Function for events (the
// iCal links stay server-side). In local mode there is no proxy, so only the sample calendar works.
import { useEffect } from 'react';
import { store, useDB } from '../data/store';
import { supabase } from '../data/supabase';
import { addDays, atTime, dayKey, now, startOfWeek } from '../lib/time';
import { calendarEvents, type CalEvent } from './calendar';

const SAMPLE_PREFIX = 'Sample';

/** Local-mode sample events (dev only), on every week, so the dotted events can be tried. */
function sampleEvents(sourceId: string, name: string, from: Date, weeks: number): CalEvent[] {
  const out: CalEvent[] = [];
  const items: [number, string, string, string][] = [
    [3, '11:00', '11:45', 'Team sync'],
    [3, '17:30', '18:15', 'Dentist'],
    [4, '15:00', '16:00', 'Study group'],
    [5, '18:30', '19:30', 'Dinner with friends'],
  ];
  for (let w = 0; w < weeks; w++) {
    const week = addDays(from, 7 * w);
    for (const [day, s, e, title] of items) {
      const date = dayKey(addDays(week, day));
      out.push({ uid: `sample-${title}`, source_id: sourceId, source_name: name, title, start: atTime(date, s).toISOString(), end: atTime(date, e).toISOString() });
    }
  }
  return out;
}

export async function fetchEvents(): Promise<CalEvent[]> {
  const sources = store.db.calendar_sources;
  if (!sources.length) return [];
  const from = addDays(startOfWeek(now()), -7);
  const to = addDays(from, 35);
  const local = sources.filter((s) => s.name.startsWith(SAMPLE_PREFIX) && !supabase);
  let events: CalEvent[] = local.flatMap((s) => sampleEvents(s.id, s.name, from, 5));
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('calendar', {
      body: { action: 'events', from: from.toISOString(), to: to.toISOString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    if (error) throw new Error(error.message);
    events = events.concat((data?.events ?? []) as CalEvent[]);
  }
  return events;
}

/** Keeps calendarEvents fresh: on load, when sources change, and every 15 minutes. */
export function useCalendarSync() {
  const db = useDB();
  const key = db.calendar_sources.map((s) => s.id).join(',');
  useEffect(() => {
    let alive = true;
    const run = () =>
      fetchEvents()
        .then((ev) => alive && calendarEvents.set(ev))
        .catch((e) => console.warn('[iterace] calendar sync failed', e));
    run();
    const id = setInterval(run, 15 * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [key]);
}

export async function addCalendarSource(provider: 'google' | 'apple' | 'other', name: string, icsUrl: string): Promise<string | null> {
  if (!supabase) return 'Calendar sync needs the Supabase project (the iCal link has to be stored and fetched on the server).';
  const { data, error } = await supabase.functions.invoke('calendar', { body: { action: 'add', provider, name, ics_url: icsUrl } });
  if (error) return error.message;
  if (data?.error) return data.error as string;
  // Reload just the sources (the row was written by the function).
  const { data: rows } = await supabase.from('calendar_sources').select('id,user_id,created_at,updated_at,provider,name');
  if (rows) {
    store.db = { ...store.db, calendar_sources: rows as typeof store.db.calendar_sources };
    store.emit();
  }
  return null;
}

export async function removeCalendarSource(id: string): Promise<string | null> {
  if (supabase) {
    const { error } = await supabase.functions.invoke('calendar', { body: { action: 'remove', id } });
    if (error) return error.message;
    store.db = { ...store.db, calendar_sources: store.db.calendar_sources.filter((s) => s.id !== id) };
    store.emit();
    return null;
  }
  const t = store.tx();
  t.remove('calendar_sources', id);
  t.commit();
  return null;
}

export function addSampleCalendar() {
  const t = store.tx();
  t.insert('calendar_sources', { provider: 'other', name: 'Sample calendar' });
  t.commit();
}
