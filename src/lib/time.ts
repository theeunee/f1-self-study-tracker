// Time helpers. Everything is shown in the browser's local time zone.
// Races run Sunday → Saturday.

const DEV = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
const OFFSET_KEY = 'iterace.dev.clockOffset';

let offsetMs = 0;
if (DEV && typeof window !== 'undefined') {
  // Dev-only time travel: ?now=2026-11-28T19:05 shifts the app clock (kept for the tab).
  try {
    const param = new URLSearchParams(window.location.search).get('now');
    if (param === 'real') sessionStorage.removeItem(OFFSET_KEY);
    else if (param) {
      const target = new Date(param).getTime();
      if (!Number.isNaN(target)) sessionStorage.setItem(OFFSET_KEY, String(target - Date.now()));
    }
    offsetMs = Number(sessionStorage.getItem(OFFSET_KEY) || 0) || 0;
  } catch {
    offsetMs = 0;
  }
}

export function nowMs(): number {
  return Date.now() + offsetMs;
}
export function now(): Date {
  return new Date(nowMs());
}
export function isTimeTravelling(): boolean {
  return offsetMs !== 0;
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const DAY_TITLE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function toDate(v: string | Date | number): Date {
  return v instanceof Date ? new Date(v.getTime()) : new Date(v);
}

/** 'YYYY-MM-DD' in local time. */
export function dayKey(d: Date | string | number): string {
  const x = toDate(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

/** Local midnight of a 'YYYY-MM-DD' key. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date | string | number): Date {
  const x = toDate(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date | string | number, n: number): Date {
  const x = toDate(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMinutes(d: Date | string | number, n: number): Date {
  return new Date(toDate(d).getTime() + n * MIN);
}

/** Sunday 00:00 of the week containing d. */
export function startOfWeek(d: Date | string | number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function sameDay(a: Date | string, b: Date | string): boolean {
  return dayKey(a) === dayKey(b);
}

/** Minutes since local midnight. */
export function minuteOfDay(d: Date | string | number): number {
  const x = toDate(d);
  return x.getHours() * 60 + x.getMinutes() + x.getSeconds() / 60;
}

/** Date at a given day + 'HH:MM'. */
export function atTime(day: Date | string, hhmm: string): Date {
  const base = typeof day === 'string' && day.length === 10 ? fromDayKey(day) : startOfDay(day);
  const [h, m] = hhmm.split(':').map(Number);
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

export function hhmm(d: Date | string | number): string {
  const x = toDate(d);
  return `${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
}

export function hhmmss(d: Date | string | number): string {
  const x = toDate(d);
  return `${hhmm(x)}:${pad2(x.getSeconds())}`;
}

export function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** '2h 5m', '57m', '4h', '0m'. */
export function fmtDur(min: number): string {
  const total = Math.round(Math.abs(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const sign = min < 0 && total > 0 ? '−' : '';
  if (h && m) return `${sign}${h}h ${m}m`;
  if (h) return `${sign}${h}h`;
  return `${sign}${m}m`;
}

/** Upper-case variant used on mono labels: '2H 5M'. */
export function fmtDurUp(min: number): string {
  return fmtDur(min).toUpperCase();
}

/** 'MM:SS' (or 'H:MM:SS' past an hour) for the countdown timer. */
export function fmtTimer(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** '03D 05H 47M' */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MIN));
  const d = Math.floor(total / (60 * 24));
  const h = Math.floor((total % (60 * 24)) / 60);
  const m = total % 60;
  return `${pad2(d)}D ${pad2(h)}H ${pad2(m)}M`;
}

/** 'WED 25' */
export function fmtDayShort(d: Date | string): string {
  const x = toDate(d);
  return `${DAY_SHORT[x.getDay()]} ${x.getDate()}`;
}

/** 'Wed 25' */
export function fmtDayTitle(d: Date | string): string {
  const x = toDate(d);
  return `${DAY_TITLE[x.getDay()]} ${x.getDate()}`;
}

/** 'SAT 28 19:00' */
export function fmtDayTime(d: Date | string): string {
  return `${fmtDayShort(d)} ${hhmm(d)}`;
}

/** '25 NOV' */
export function fmtDateShort(d: Date | string): string {
  const x = toDate(typeof d === 'string' && d.length === 10 ? fromDayKey(d) : d);
  return `${x.getDate()} ${MONTH_SHORT[x.getMonth()]}`;
}

/** '25 NOV 26' when not this year, else '25 NOV' */
export function fmtDateSmart(d: Date | string, ref: Date = now()): string {
  const x = toDate(typeof d === 'string' && d.length === 10 ? fromDayKey(d) : d);
  const base = fmtDateShort(x);
  return x.getFullYear() === ref.getFullYear() ? base : `${base} ${String(x.getFullYear()).slice(2)}`;
}

/** 'SUN 31 JAN 2027' */
export function fmtDateLong(d: Date | string): string {
  const x = toDate(typeof d === 'string' && d.length === 10 ? fromDayKey(d) : d);
  return `${DAY_SHORT[x.getDay()]} ${x.getDate()} ${MONTH_SHORT[x.getMonth()]} ${x.getFullYear()}`;
}

/** 'SUN 22 – SAT 28 NOV' (month on both sides when it changes). */
export function fmtWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${fmtDayShort(start)} – ${fmtDayShort(end)} ${MONTH_SHORT[end.getMonth()]}`
    : `${fmtDayShort(start)} ${MONTH_SHORT[start.getMonth()]} – ${fmtDayShort(end)} ${MONTH_SHORT[end.getMonth()]}`;
}

/** Whole days from today to a date (D-67). */
export function daysUntil(day: string, ref: Date = now()): number {
  return Math.round((fromDayKey(day).getTime() - startOfDay(ref).getTime()) / DAY);
}

/** Parse a duration typed by hand: '5', '4.5', '4h 30m', '4:30', '45m', '90M'. Returns minutes or null. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h?$/))) return Math.round(Number(m[1]) * 60);
  if ((m = s.match(/^(\d+)\s*m(?:in)?$/))) return Number(m[1]);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h\s*(\d+)\s*m?$/))) return Math.round(Number(m[1]) * 60) + Number(m[2]);
  return null;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function snap(min: number, step = 15): number {
  return Math.round(min / step) * step;
}

/** 'Tue 24 19:00' — for race-log details and body text. */
export function fmtWhen(d: Date | string): string {
  return `${fmtDayTitle(d)} ${hhmm(d)}`;
}
