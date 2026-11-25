// Calendar events (brief §5 Calendar events, slice 7). Events come read-only from the user's private
// iCal links through the `calendar` Edge Function; the links never reach the browser.
// Events show dotted on the grids: + adds one as a lap with no goal, × dismisses it. Both are logged.
import type { Store } from '../data/store';
import type { DB, Race } from '../data/types';
import { createSignal } from '../lib/hooks';
import { dayKey, fmtWhen } from '../lib/time';
import type { CalGhost } from '../pages/raceweek/WeekGrid';

export interface CalEvent {
  uid: string;
  source_id: string;
  source_name: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
}

export const calendarEvents = createSignal<CalEvent[]>([]);

export function calendarGhosts(db: DB, events: CalEvent[], days: Date[]): CalGhost[] {
  const keys = new Set(days.map(dayKey));
  return events
    .filter((e) => keys.has(dayKey(e.start)))
    .filter((e) => !db.calendar_choices.some((c) => c.source_id === e.source_id && c.event_uid === e.uid && c.date === dayKey(e.start)))
    .map((e) => ({
      key: `cal:${e.source_id}:${e.uid}:${dayKey(e.start)}`,
      kind: 'calendar' as const,
      title: e.title,
      start: new Date(e.start),
      min: Math.max(15, Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000)),
      source: e.source_name,
    }));
}

function parseKey(g: CalGhost) {
  const [, source_id, ...rest] = g.key.split(':');
  const date = rest.pop()!;
  return { source_id, uid: rest.join(':'), date };
}

/** + : the event becomes a lap with no goal (give it one later in the lap editor). */
export function addCalendarEvent(store: Store, race: Race, g: CalGhost, page: 'home' | 'week') {
  const k = parseKey(g);
  const t = store.tx();
  const lap = t.insert('laps', {
    race_id: race.id,
    goal_id: null,
    title: g.title,
    description: '',
    planned_start: g.start.toISOString(),
    planned_min: g.min,
    color: null,
    auto_end: true,
    status: 'planned',
    source: 'calendar',
    moved_from_lap_id: null,
    carried_from_lap_id: null,
  });
  t.insert('calendar_choices', { source_id: k.source_id, event_uid: k.uid, date: k.date, choice: 'added', lap_id: lap.id });
  t.log({ race_id: race.id, page, kind: 'event-add', main: `Added ${g.title}`, detail: `from ${g.source} · ${fmtWhen(g.start)}` });
  return t.commit();
}

export function dismissCalendarEvent(store: Store, race: Race, g: CalGhost, page: 'home' | 'week') {
  const k = parseKey(g);
  const t = store.tx();
  t.insert('calendar_choices', { source_id: k.source_id, event_uid: k.uid, date: k.date, choice: 'dismissed', lap_id: null });
  t.log({ race_id: race.id, page, kind: 'event-dismiss', main: `Dismissed ${g.title}`, detail: `${g.source} event · ${fmtWhen(g.start)}` });
  return t.commit();
}
