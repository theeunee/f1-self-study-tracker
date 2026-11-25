// Development sample data (brief §10.6): a few goals, three finished races and a live one this week.
// Everything is relative to "now", so the sample always looks current. Used by the local
// "Load sample data" button and by `npm run seed` (scripts/seed.ts).
import { type AnyRow, type DB, type TableName, type Tables, emptyDB } from './types';
import { DEFAULT_BOARD, DEFAULT_PRESETS, sessionAfter } from '../domain/selectors';
import { MIN, addDays, atTime, dayKey, startOfWeek, uid } from '../lib/time';

export function buildSeed(userId: string, displayName: string, nowDate: Date): DB {
  const db = emptyDB();
  const stamp = new Date(nowDate.getTime() - 60 * 24 * 60 * MIN).toISOString();
  function add<T extends TableName>(table: T, data: Omit<Tables[T], 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string }): Tables[T] {
    const row = { id: uid(), user_id: userId, created_at: stamp, updated_at: stamp, ...data } as unknown as Tables[T];
    (db[table] as AnyRow[]).push(row as AnyRow);
    return row;
  }

  add('profiles', {
    id: userId,
    display_name: displayName,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    session_weekday: 6,
    session_time: '19:00',
    colour_board: DEFAULT_BOARD,
    length_presets: DEFAULT_PRESETS,
  });

  const week = startOfWeek(nowDate);
  const d = (offsetDays: number) => dayKey(addDays(week, offsetDays));

  const goal = (name: string, color: string, start: number, due: number, target: number, s: string, m: string, a: string, r: string, order: number) =>
    add('goals', {
      name, color, status: 'active', start_date: d(start), due_date: d(due), weekly_target_min: target,
      smart_s: s, smart_m: m, smart_a: a, smart_r: r, sort_order: order,
      achieved_on: null, archived_on: null, deleted_at: null,
    });

  const portfolio = goal('Portfolio', '#00A86B', -24, 25, 120, 'Launch a personal portfolio site.', 'Live at my own domain with three project write-ups.', '', 'Needed for internship applications in January.', 0);
  const python = goal('Python', '#1C64F2', -52, 67, 300, 'Ship the data-cleaning tool as a small open-source package.', 'On GitHub with passing tests and a readme someone else can follow.', 'Five hours a week. The parsing is about half done.', 'I use it every week for the lab data.', 1);
  const reading = goal('Reading', '#7A3CE0', -87, 200, 180, '12 books this school year.', 'Four books a term, logged here.', 'Three hours a week is about one book a month.', '', 2);
  const japanese = goal('Japanese', '#E10600', -80, 221, 240, 'Pass the JLPT N3 at the July sitting.', 'A passing score on a full practice test by March.', 'Four hours a week, mostly drills and reading.', 'I want to study in Japan next year.', 3);
  const kanji = add('goals', {
    name: 'Kanji N4', color: '#111111', status: 'achieved', start_date: d(-178), due_date: d(-25), weekly_target_min: 120,
    smart_s: 'Learn all the N4 kanji.', smart_m: 'Every N4 card at "known" in my deck.', smart_a: 'Two hours a week.', smart_r: 'The base for N3.',
    sort_order: 4, achieved_on: d(-32), archived_on: null, deleted_at: null,
  });
  void kanji;

  const sub = (g: { id: string }, title: string, s: number, e: number, done = false) =>
    add('subgoals', { goal_id: g.id, title, start_date: d(s), due_date: d(e), done });
  sub(portfolio, 'Pick a domain', -24, -10, true);
  sub(portfolio, 'About page', -10, 4);
  sub(portfolio, 'Three project write-ups', 4, 18);
  sub(python, 'Load the export', -52, -10, true);
  sub(python, 'Parse every date format', -10, 11);
  sub(python, 'Tests passing', 11, 25);
  sub(python, 'Publish v0.1', 25, 67);
  sub(reading, 'Autumn: 4 books', -87, 18);
  sub(reading, 'Winter: 4 books', 18, 116);
  sub(reading, 'Spring: 4 books', 116, 200);
  sub(japanese, 'Finish the N4 review', -80, -25, true);
  sub(japanese, 'Know 650 N3 kanji', -24, 186);
  sub(japanese, 'Pass a full N3 practice test', 39, 123);
  sub(japanese, 'Register for the July exam', 95, 140);

  add('goal_marks', { goal_id: python.id, kind: 'deadline_moved', from_date: d(39), to_date: d(67), made_on: d(-13) });

  // Three finished races, then this week's live race (Race 04).
  const slot = { weekday: 6, time: '19:00' };
  const races = [3, 2, 1].map((back, i) => {
    const start = atTime(addDays(week, -7 * back), '09:00');
    const ses = sessionAfter(start, slot);
    return add('races', { number: i + 1, starts_at: start.toISOString(), session_at: ses.toISOString(), ended_at: ses.toISOString(), status: 'done' });
  });
  const raceStart = atTime(week, '08:00');
  const race = add('races', {
    number: 4,
    starts_at: raceStart.toISOString(),
    session_at: sessionAfter(raceStart, slot).toISOString(),
    ended_at: null,
    status: 'live',
  });

  // History for the finished races, so the goal history and debrief notes have something in them.
  const pastPlan: [typeof python, string, number, string, number, number][] = [
    [python, 'Read the export spec', 1, '14:00', 60, 70],
    [python, 'Sketch the parser', 3, '13:00', 90, 80],
    [japanese, 'Grammar drills', 2, '09:30', 45, 45],
    [japanese, 'Kanji review', 4, '09:30', 30, 30],
    [reading, 'Chapter 1', 2, '21:00', 30, 35],
    [reading, 'Chapter 2', 5, '21:00', 30, 0],
    [portfolio, 'Choose a template', 6, '10:00', 60, 50],
  ];
  races.forEach((r, ri) => {
    const rWeek = startOfWeek(new Date(r.starts_at));
    for (const [g, title, day, time, plan, did] of pastPlan) {
      const start = atTime(addDays(rWeek, day), time);
      const lap = add('laps', {
        race_id: r.id, goal_id: g.id, title, description: '', planned_start: start.toISOString(), planned_min: plan,
        color: null, auto_end: true, status: did >= plan ? 'done' : 'planned', source: 'manual',
        moved_from_lap_id: null, carried_from_lap_id: null,
      });
      const amount = Math.max(0, did - ri * 5);
      if (amount > 0) add('lap_times', { lap_id: lap.id, started_at: start.toISOString(), ended_at: new Date(start.getTime() + amount * MIN).toISOString(), how: 'timed' });
    }
  });
  add('debriefs', { race_id: races[2].id, why: 'Evening reading kept slipping, so it moves to before dinner.', goal_notes: { [python.id]: 'Python ran over twice. Plan 1h blocks with a 15-minute buffer.' } });

  // This race's laps, as in the design (Sun 0 … Sat 6).
  type L = [typeof python | null, string, number, string, number, string?];
  const plan: L[] = [
    [japanese, 'Vocabulary set 12', 1, '09:30', 30],
    [python, 'Read the CSV into a table', 1, '14:00', 60],
    [japanese, 'Kanji flashcards', 1, '19:00', 30],
    [japanese, 'Listening practice', 2, '09:30', 30],
    [python, 'Find the broken rows', 2, '13:30', 60],
    [reading, 'Chapter 4', 2, '19:00', 30],
    [japanese, 'Shadowing practice', 2, '20:30', 30],
    [japanese, 'Grammar drills — unit 6', 3, '09:30', 45, 'Units 6.1 to 6.4, then the review page.'],
    [python, 'Parse the date column', 3, '13:00', 60, 'Handle 25/11/2026, 2026-11-25 and “Nov 25”.'],
    [reading, 'Chapter 5', 3, '16:30', 30],
    [portfolio, 'Outline the About page', 3, '20:00', 25],
    [japanese, 'Kanji review', 4, '09:30', 30],
    [python, 'Write tests for the cleaner', 4, '13:00', 60],
    [japanese, 'Reading drill', 5, '09:30', 30],
    [reading, 'Chapter 6', 5, '15:00', 30],
    [portfolio, 'Draft the first write-up', 5, '20:00', 45],
    [japanese, 'Practice test', 6, '10:00', 60],
    [portfolio, 'Share the draft', 6, '14:00', 30],
  ];
  const nowMs = nowDate.getTime();
  let running = false;
  plan.forEach(([g, title, day, time, min, desc], i) => {
    const start = atTime(addDays(week, day), time);
    const end = start.getTime() + min * MIN;
    const past = end <= nowMs;
    const current = start.getTime() <= nowMs && end > nowMs;
    // Past laps: most done, a few skipped (so carry/drop has something to decide).
    const skip = past && [2, 6, 10].includes(i);
    const short = past && i === 5;
    const lap = add('laps', {
      race_id: race.id, goal_id: g?.id ?? null, title, description: desc ?? '', planned_start: start.toISOString(), planned_min: min,
      color: null, auto_end: true, status: past && !skip && !short ? 'done' : 'planned', source: 'manual',
      moved_from_lap_id: null, carried_from_lap_id: null,
    });
    if (past && !skip) {
      const did = short ? Math.round(min / 2) : min + (i % 4 === 1 ? 10 : 0);
      add('lap_times', { lap_id: lap.id, started_at: start.toISOString(), ended_at: new Date(start.getTime() + did * MIN).toISOString(), how: i === 3 ? 'by_hand' : 'timed' });
    } else if (current && !running) {
      running = true;
      add('lap_times', { lap_id: lap.id, started_at: start.toISOString(), ended_at: null, how: 'timed' });
    }
  });
  // One lap waiting in Laps to place.
  add('laps', {
    race_id: race.id, goal_id: reading.id, title: 'Chapter 7', description: '', planned_start: null, planned_min: 30,
    color: null, auto_end: true, status: 'planned', source: 'manual', moved_from_lap_id: null, carried_from_lap_id: null,
  });

  add('briefs', {
    race_id: race.id,
    focus: 'Get the date parsing working before Thursday’s study group.',
    subgoal_focus: {
      [python.id]: db.subgoals.find((s) => s.title === 'Parse every date format')!.id,
      [japanese.id]: db.subgoals.find((s) => s.title === 'Know 650 N3 kanji')!.id,
      [portfolio.id]: db.subgoals.find((s) => s.title === 'About page')!.id,
      [reading.id]: db.subgoals.find((s) => s.title === 'Autumn: 4 books')!.id,
    },
    start_at: raceStart.toISOString(),
  });

  add('log_entries', {
    race_id: race.id, page: 'week', kind: 'race-start', main: 'Race 04 started', detail: 'start time set in the Mechanics session',
    payload: null, undone: false, note: '', created_at: raceStart.toISOString(),
  });

  add('countdowns', { name: 'JLPT N3', date: d(221), time: '09:00', selected: false });
  return db;
}
