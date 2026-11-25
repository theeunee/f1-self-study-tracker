// Race Engineer lines for the radio hover (and ONBOARD). Per page, cycling one line per hover,
// using the signed-in user's display name (brief §8: never a hard-coded name).
import type { DB } from '../data/types';
import { activeLap, lapsOnDay } from '../domain/active';
import { activeGoals, countedLaps, driverRace, lapIsDone, profileOf, sessionRace } from '../domain/selectors';
import { MIN, dayKey, daysUntil, fmtDayTime, fmtDur } from '../lib/time';

export type RadioPage = 'home' | 'week' | 'goals';

export function engineerLines(db: DB, page: RadioPage, nowMs: number, mech = false): string[] {
  const name = profileOf(db)?.display_name?.trim() || 'driver';
  const ses = sessionRace(db);
  if (ses) {
    return [
      'Pit wall’s open. Debrief, carry or drop, plan, then the brief. Any order.',
      'Take your time. Nothing runs while you’re in the garage.',
      `Radio check. Loud and clear, ${name}.`,
    ];
  }
  const race = driverRace(db);
  const laps = countedLaps(db, race?.id).filter((l) => l.planned_start);
  const raceDone = laps.filter((l) => lapIsDone(db, l, nowMs)).length;
  const sessionLine = race && race.status !== 'done' ? `Mechanics session ${fmtDayTime(race.session_at)}.` : '';
  const radioCheck = `Radio check. Loud and clear, ${name}.`;
  if (page === 'home') {
    const today = lapsOnDay(db, dayKey(nowMs)).filter((l) => l.status !== 'moved');
    const doneToday = today.filter((l) => lapIsDone(db, l, nowMs)).length;
    const a = activeLap(db, nowMs);
    const lines: string[] = [];
    if (a) {
      lines.push(`${doneToday} of ${today.length} laps done today. “${a.lap.title}” is ${a.running ? 'on track.' : 'paused.'}`);
      lines.push(
        a.running
          ? `${Math.max(0, Math.floor((a.lap.planned_min * MIN - a.remainingMs) / MIN))} minutes into “${a.lap.title}”. Nice and steady, ${name}.`
          : 'Timer’s paused. The car will wait for you.',
      );
    } else lines.push(`${doneToday} of ${today.length} laps done today.`);
    lines.push(`${raceDone} of ${laps.length} laps done this race. ${sessionLine}`.trim());
    lines.push(radioCheck);
    return lines;
  }
  if (page === 'week') {
    return [
      `${raceDone} of ${laps.length} laps done this race. Keep it steady.`,
      mech ? 'Pit wall’s open. Small changes only, and save before you head back out.' : `Mechanics session is ${race ? fmtDayTime(race.session_at) : 'on Saturday'}.`,
      radioCheck,
    ];
  }
  const goals = activeGoals(db);
  const weekly = goals.reduce((s, g) => s + g.weekly_target_min, 0);
  const nearest = [...goals].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const days = nearest ? daysUntil(nearest.due_date) : 0;
  return [
    `${goals.length} active goals · ${fmtDur(weekly)} a week across them.`,
    nearest ? `${nearest.name} is due in ${days} days. That’s ${Math.ceil(days / 7)} races.` : 'No deadlines coming up.',
    radioCheck,
  ];
}

export function onboardLine(db: DB, nowMs: number): string {
  return engineerLines(db, 'home', nowMs)[0];
}
