// Row types. These mirror supabase/migrations/0001_init.sql one-to-one.
// Moments are ISO strings (timestamptz); plain dates are 'YYYY-MM-DD'; times are 'HH:MM'.

export interface BaseRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile extends BaseRow {
  display_name: string;
  timezone: string;
  session_weekday: number; // 0 = Sun … 6 = Sat
  session_time: string; // 'HH:MM'
  colour_board: string[];
  length_presets: number[]; // minutes
}

export type GoalStatus = 'active' | 'achieved' | 'archived';

export interface Goal extends BaseRow {
  name: string;
  color: string;
  status: GoalStatus;
  start_date: string;
  due_date: string;
  weekly_target_min: number;
  smart_s: string;
  smart_m: string;
  smart_a: string;
  smart_r: string;
  sort_order: number;
  achieved_on: string | null;
  archived_on: string | null;
  deleted_at: string | null;
}

export interface GoalMark extends BaseRow {
  goal_id: string;
  kind: 'deadline_moved';
  from_date: string;
  to_date: string;
  made_on: string;
}

export interface Subgoal extends BaseRow {
  goal_id: string;
  title: string;
  start_date: string;
  due_date: string;
  done: boolean;
}

export type RaceStatus = 'planned' | 'live' | 'in_session' | 'done';

export interface Race extends BaseRow {
  number: number;
  starts_at: string;
  session_at: string;
  ended_at: string | null;
  status: RaceStatus;
}

export interface RaceTarget extends BaseRow {
  race_id: string;
  goal_id: string;
  target_min: number;
}

export type LapStatus = 'planned' | 'done' | 'moved' | 'dropped';
export type LapSource = 'manual' | 'repeat' | 'calendar' | 'carried';

export interface Lap extends BaseRow {
  race_id: string;
  goal_id: string | null;
  title: string;
  description: string;
  planned_start: string | null; // null = in Laps to place
  planned_min: number;
  color: string | null;
  auto_end: boolean;
  status: LapStatus;
  source: LapSource;
  moved_from_lap_id: string | null;
  carried_from_lap_id: string | null;
}

export interface LapTime extends BaseRow {
  lap_id: string;
  started_at: string;
  ended_at: string | null; // null while running
  how: 'timed' | 'by_hand';
}

export interface RepeatRule extends BaseRow {
  goal_id: string | null;
  title: string;
  days: number[]; // 0 = Sun … 6 = Sat
  start_time: string;
  length_min: number;
  from_date: string;
  until_date: string | null;
}

export interface RepeatChoice extends BaseRow {
  rule_id: string;
  date: string;
  choice: 'kept' | 'skipped';
  lap_id: string | null;
}

export interface CalendarSource extends BaseRow {
  provider: 'google' | 'apple' | 'other';
  name: string;
  // ics_url lives only in the database / Edge Function; the client never selects it.
}

export interface CalendarChoice extends BaseRow {
  source_id: string;
  event_uid: string;
  date: string;
  choice: 'added' | 'dismissed';
  lap_id: string | null;
}

export interface Countdown extends BaseRow {
  name: string;
  date: string;
  time: string | null;
  selected: boolean;
}

export type LogPage = 'home' | 'week' | 'goals' | 'session';

export interface RowOp {
  table: TableName;
  id: string;
  before: AnyRow | null;
  after: AnyRow | null;
}

export interface LogEntry extends BaseRow {
  race_id: string;
  page: LogPage;
  kind: string;
  main: string;
  detail: string;
  payload: { ops: RowOp[] } | null;
  undone: boolean;
  note: string;
}

export interface Debrief extends BaseRow {
  race_id: string;
  why: string;
  goal_notes: Record<string, string>;
}

export interface Brief extends BaseRow {
  race_id: string; // the race being planned
  focus: string;
  subgoal_focus: Record<string, string>; // goal_id → subgoal_id
  start_at: string | null;
}

export interface CarryChoice extends BaseRow {
  race_id: string; // the race that ended
  lap_id: string; // the unfinished lap
  choice: 'carry' | 'drop';
}

export interface SessionChecks extends BaseRow {
  race_id: string;
  debrief: boolean;
  unfinished: boolean;
  plan: boolean;
  brief: boolean;
}

export interface Tables {
  profiles: Profile;
  goals: Goal;
  goal_marks: GoalMark;
  subgoals: Subgoal;
  races: Race;
  race_targets: RaceTarget;
  laps: Lap;
  lap_times: LapTime;
  repeat_rules: RepeatRule;
  repeat_choices: RepeatChoice;
  calendar_sources: CalendarSource;
  calendar_choices: CalendarChoice;
  countdowns: Countdown;
  log_entries: LogEntry;
  debriefs: Debrief;
  briefs: Brief;
  carry_choices: CarryChoice;
  session_checks: SessionChecks;
}

export type TableName = keyof Tables;
export type AnyRow = Tables[TableName];

export const TABLES: TableName[] = [
  'profiles',
  'goals',
  'goal_marks',
  'subgoals',
  'races',
  'race_targets',
  'laps',
  'lap_times',
  'repeat_rules',
  'repeat_choices',
  'calendar_sources',
  'calendar_choices',
  'countdowns',
  'log_entries',
  'debriefs',
  'briefs',
  'carry_choices',
  'session_checks',
];

export type DB = { [K in TableName]: Tables[K][] };

export function emptyDB(): DB {
  const db = {} as DB;
  for (const t of TABLES) (db as Record<string, unknown[]>)[t] = [];
  return db;
}
