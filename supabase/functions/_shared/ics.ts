// Minimal iCalendar (RFC 5545) reader for read-only calendar sync.
// Handles VEVENT with UID, SUMMARY, DTSTART/DTEND (UTC, floating, TZID, all-day), DURATION,
// RRULE (DAILY/WEEKLY/MONTHLY with INTERVAL, COUNT, UNTIL, BYDAY), EXDATE, and RECURRENCE-ID overrides.
// No dependencies, so it runs in Deno (Edge Function) and in Vitest.

export interface IcsEvent {
  uid: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
}

interface Raw {
  uid: string;
  summary: string;
  dtstart?: Prop;
  dtend?: Prop;
  duration?: string;
  rrule?: string;
  exdates: Date[];
  recurrenceId?: Date;
  status?: string;
}
interface Prop {
  value: string;
  params: Record<string, string>;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name, ...rest] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of rest) {
    const [k, v] = p.split('=');
    if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

/** Offset (ms) of a time zone at a moment, using Intl (works in Deno and Node). */
function tzOffsetMs(tz: string, at: Date): number {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const parts = Object.fromEntries(f.formatToParts(at).map((p) => [p.type, p.value]));
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return asUtc - at.getTime();
  } catch {
    return 0;
  }
}

export function parseDate(p: Prop, fallbackTz: string): { date: Date; allDay: boolean } {
  const v = p.value.trim();
  if (p.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    const d = new Date(Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)));
    // All-day: midnight in the viewer's zone.
    const off = tzOffsetMs(fallbackTz, d);
    return { date: new Date(d.getTime() - off), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return { date: new Date(NaN), allDay: false };
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  if (m[7] === 'Z') return { date: new Date(utc), allDay: false };
  const tz = p.params.TZID || fallbackTz;
  const off = tzOffsetMs(tz, new Date(utc));
  // Correct once more around DST changes.
  const guess = utc - off;
  const off2 = tzOffsetMs(tz, new Date(guess));
  return { date: new Date(utc - off2), allDay: false };
}

function parseDuration(s: string): number {
  const m = s.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const ms = ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 86400 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
  return sign * ms;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function expand(start: Date, rrule: string, from: Date, to: Date, tz: string): Date[] {
  const r = Object.fromEntries(rrule.split(';').map((kv) => kv.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
  const freq = r.FREQ;
  const interval = Math.max(1, +(r.INTERVAL || 1));
  const count = r.COUNT ? +r.COUNT : Infinity;
  const until = r.UNTIL ? parseDate({ value: r.UNTIL, params: {} }, tz).date : null;
  const byday = r.BYDAY ? r.BYDAY.split(',').map((d: string) => DAYS.indexOf(d.slice(-2))) : null;
  const out: Date[] = [];
  let n = 0;
  const step = (d: Date, k: number) => {
    const x = new Date(d.getTime());
    if (freq === 'DAILY') x.setUTCDate(x.getUTCDate() + k);
    else if (freq === 'WEEKLY') x.setUTCDate(x.getUTCDate() + 7 * k);
    else if (freq === 'MONTHLY') x.setUTCMonth(x.getUTCMonth() + k);
    else if (freq === 'YEARLY') x.setUTCFullYear(x.getUTCFullYear() + k);
    return x;
  };
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return [start];
  for (let i = 0; i < 5000 && n < count; i++) {
    const base = step(start, i * interval);
    const candidates: Date[] = [];
    if (freq === 'WEEKLY' && byday) {
      const sunday = new Date(base.getTime());
      sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
      for (const d of [...byday].sort()) {
        const c = new Date(sunday.getTime());
        c.setUTCDate(c.getUTCDate() + d);
        if (c.getTime() >= start.getTime()) candidates.push(c);
      }
    } else candidates.push(base);
    for (const c of candidates) {
      if (until && c.getTime() > until.getTime()) return out;
      if (n >= count) return out;
      n++;
      if (c.getTime() > to.getTime()) return out;
      if (c.getTime() >= from.getTime() - 86400000) out.push(c);
    }
  }
  return out;
}

export function parseIcs(text: string, from: Date, to: Date, tz = 'UTC'): IcsEvent[] {
  const lines = unfold(text);
  const raws: Raw[] = [];
  let cur: Raw | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { uid: '', summary: '', exdates: [] };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) raws.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'UID') cur.uid = p.value;
    else if (p.name === 'SUMMARY') cur.summary = p.value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ').replace(/\\\\/g, '\\');
    else if (p.name === 'DTSTART') cur.dtstart = { value: p.value, params: p.params };
    else if (p.name === 'DTEND') cur.dtend = { value: p.value, params: p.params };
    else if (p.name === 'DURATION') cur.duration = p.value;
    else if (p.name === 'RRULE') cur.rrule = p.value;
    else if (p.name === 'STATUS') cur.status = p.value;
    else if (p.name === 'EXDATE') for (const v of p.value.split(',')) cur.exdates.push(parseDate({ value: v, params: p.params }, tz).date);
    else if (p.name === 'RECURRENCE-ID') cur.recurrenceId = parseDate({ value: p.value, params: p.params }, tz).date;
  }

  const overrides = new Map<string, Raw>();
  for (const r of raws) if (r.recurrenceId) overrides.set(`${r.uid}|${r.recurrenceId.getTime()}`, r);

  const out: IcsEvent[] = [];
  for (const r of raws) {
    if (!r.dtstart || r.recurrenceId || r.status === 'CANCELLED') continue;
    const s = parseDate(r.dtstart, tz);
    if (Number.isNaN(s.date.getTime())) continue;
    const e = r.dtend ? parseDate(r.dtend, tz).date : new Date(s.date.getTime() + (r.duration ? parseDuration(r.duration) : s.allDay ? 86400000 : 3600000));
    const len = Math.max(0, e.getTime() - s.date.getTime());
    const starts = r.rrule ? expand(s.date, r.rrule, from, to, tz) : [s.date];
    for (const st of starts) {
      if (r.exdates.some((x) => x.getTime() === st.getTime())) continue;
      const o = overrides.get(`${r.uid}|${st.getTime()}`);
      let begin = st;
      let end = new Date(st.getTime() + len);
      let title = r.summary;
      if (o) {
        if (o.status === 'CANCELLED') continue;
        if (o.dtstart) begin = parseDate(o.dtstart, tz).date;
        end = o.dtend ? parseDate(o.dtend, tz).date : new Date(begin.getTime() + len);
        title = o.summary || title;
      }
      if (end.getTime() <= from.getTime() || begin.getTime() >= to.getTime()) continue;
      out.push({ uid: r.rrule ? `${r.uid}@${st.toISOString()}` : r.uid, title: title || '(no title)', start: begin.toISOString(), end: end.toISOString(), allDay: s.allDay });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
