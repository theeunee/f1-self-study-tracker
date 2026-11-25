// The app keeps every row the signed-in user owns in memory (one person's planner is small),
// and writes each change through an adapter: Supabase when configured, else this browser.
// Every logged change stores before/after rows so it can be undone.

import { useSyncExternalStore } from 'react';
import { dayKey, now, uid } from '../lib/time';
import {
  type AnyRow,
  type DB,
  type LogEntry,
  type LogPage,
  type RowOp,
  type TableName,
  type Tables,
  TABLES,
  emptyDB,
} from './types';

export interface Change {
  table: TableName;
  op: 'upsert' | 'delete';
  row: AnyRow;
}

export interface Adapter {
  kind: 'local' | 'supabase';
  load(userId: string): Promise<DB>;
  write(changes: Change[]): Promise<void>;
}

export interface LogInput {
  race_id: string;
  page: LogPage;
  kind: string;
  main: string;
  detail?: string;
}

type Listener = () => void;

export class Store {
  db: DB = emptyDB();
  userId = '';
  adapter: Adapter | null = null;
  ready = false;
  saveError: string | null = null;
  private listeners = new Set<Listener>();
  private queue: Promise<void> = Promise.resolve();

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.db;

  emit() {
    for (const l of this.listeners) l();
  }

  async init(adapter: Adapter, userId: string) {
    this.adapter = adapter;
    this.userId = userId;
    this.db = await adapter.load(userId);
    this.ready = true;
    this.emit();
  }

  /** Replace everything (used by the local seed / reset). */
  replaceAll(db: DB) {
    const changes: Change[] = [];
    for (const t of TABLES) for (const r of this.db[t] as AnyRow[]) changes.push({ table: t, op: 'delete', row: r });
    for (const t of TABLES) for (const r of db[t] as AnyRow[]) changes.push({ table: t, op: 'upsert', row: r });
    this.db = db;
    this.emit();
    this.persist(changes);
  }

  tx(): Tx {
    return new Tx(this);
  }

  /** Apply a finished transaction. */
  apply(next: DB, changes: Change[]) {
    this.db = next;
    this.emit();
    this.persist(changes);
  }

  private persist(changes: Change[]) {
    if (!this.adapter || !changes.length) return;
    const adapter = this.adapter;
    this.queue = this.queue
      .then(() => adapter.write(changes))
      .then(() => {
        if (this.saveError) {
          this.saveError = null;
          this.emit();
        }
      })
      .catch((err: unknown) => {
        this.saveError = err instanceof Error ? err.message : String(err);
        console.error('[iterace] save failed', err);
        this.emit();
      });
  }

  get<T extends TableName>(table: T, id: string | null | undefined): Tables[T] | undefined {
    if (!id) return undefined;
    return (this.db[table] as Tables[T][]).find((r) => r.id === id);
  }

  /** Undo a logged change. Only today's entries can be undone (brief §5, Radio log). */
  undo(entryId: string): { ok: true } | { ok: false; reason: string } {
    const entry = this.get('log_entries', entryId);
    if (!entry) return { ok: false, reason: 'That change is gone.' };
    if (entry.undone) return { ok: false, reason: 'Already undone.' };
    if (dayKey(entry.created_at) !== dayKey(now())) return { ok: false, reason: 'Only today’s changes can be undone.' };
    const ops = entry.payload?.ops ?? [];
    // Refuse if a row was changed again after this entry (undoing would wipe that later change).
    for (const op of ops) {
      const cur = this.get(op.table, op.id) as AnyRow | undefined;
      if (op.after && cur && cur.updated_at !== op.after.updated_at) {
        return { ok: false, reason: 'Something changed since. Undo the newer change first.' };
      }
      if (op.after && !cur) return { ok: false, reason: 'Something changed since. Undo the newer change first.' };
    }
    const t = this.tx();
    for (const op of [...ops].reverse()) {
      if (op.before) t.restore(op.table, op.before);
      else t.remove(op.table, op.id);
    }
    t.update('log_entries', entry.id, { undone: true });
    t.commit();
    return { ok: true };
  }
}

export class Tx {
  private draft: DB;
  private touched = new Set<TableName>();
  private ops: RowOp[] = [];
  private changes: Change[] = [];
  private logInput: LogInput | null = null;
  private store: Store;
  logId: string | null = null;

  constructor(store: Store) {
    this.store = store;
    this.draft = { ...store.db };
  }

  /** Reads see this transaction's pending changes. */
  get db(): DB {
    return this.draft;
  }

  get<T extends TableName>(table: T, id: string | null | undefined): Tables[T] | undefined {
    if (!id) return undefined;
    return (this.draft[table] as Tables[T][]).find((r) => r.id === id);
  }

  private rows<T extends TableName>(table: T): Tables[T][] {
    if (!this.touched.has(table)) {
      (this.draft as Record<string, unknown>)[table] = [...this.draft[table]];
      this.touched.add(table);
    }
    return this.draft[table] as Tables[T][];
  }

  private record(table: TableName, id: string, before: AnyRow | null, after: AnyRow | null) {
    // Collapse repeated edits of one row inside one transaction into a single net op.
    const existing = this.ops.find((o) => o.table === table && o.id === id);
    if (existing) existing.after = after;
    else this.ops.push({ table, id, before, after });
    const ci = this.changes.findIndex((c) => c.table === table && c.row.id === id);
    const change: Change | null = after
      ? { table, op: 'upsert', row: after }
      : before
        ? { table, op: 'delete', row: before }
        : null;
    if (ci >= 0) this.changes.splice(ci, 1);
    if (change) this.changes.push(change);
  }

  insert<T extends TableName>(
    table: T,
    data: Omit<Tables[T], 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string },
  ): Tables[T] {
    const stamp = now().toISOString();
    const row = {
      ...data,
      id: data.id ?? uid(),
      user_id: this.store.userId,
      created_at: stamp,
      updated_at: stamp,
    } as unknown as Tables[T];
    this.rows(table).push(row);
    this.record(table, row.id, null, row as AnyRow);
    return row;
  }

  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Tables[T] | undefined {
    const rows = this.rows(table);
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return undefined;
    const before = rows[i];
    const after = { ...before, ...patch, updated_at: bumpStamp(before.updated_at) } as Tables[T];
    rows[i] = after;
    this.record(table, id, before as AnyRow, after as AnyRow);
    return after;
  }

  remove<T extends TableName>(table: T, id: string) {
    const rows = this.rows(table);
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    const [before] = rows.splice(i, 1);
    this.record(table, id, before as AnyRow, null);
  }

  /** Put a row back exactly as it was (used by undo). */
  restore<T extends TableName>(table: T, row: Tables[T]) {
    const rows = this.rows(table);
    const i = rows.findIndex((r) => r.id === row.id);
    const before = i >= 0 ? rows[i] : null;
    const after = { ...row, updated_at: bumpStamp(before?.updated_at ?? row.updated_at) } as Tables[T];
    if (i >= 0) rows[i] = after;
    else rows.push(after);
    this.record(table, row.id, before as AnyRow | null, after as AnyRow);
  }

  log(input: LogInput) {
    this.logInput = input;
    return this;
  }

  get hasChanges() {
    return this.ops.length > 0;
  }

  commit(): string | null {
    if (!this.ops.length) return null;
    if (this.logInput) {
      const payloadOps = this.ops.map((o) => ({ ...o }));
      const entry = this.insert('log_entries', {
        race_id: this.logInput.race_id,
        page: this.logInput.page,
        kind: this.logInput.kind,
        main: this.logInput.main,
        detail: this.logInput.detail ?? '',
        payload: { ops: payloadOps },
        undone: false,
        note: '',
      } as Omit<LogEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>);
      this.logId = entry.id;
    }
    this.store.apply(this.draft, this.changes);
    return this.logId;
  }
}

/** updated_at always moves forward, even within one millisecond, so undo can detect later edits. */
function bumpStamp(prev: string): string {
  const t = now().getTime();
  const p = new Date(prev).getTime();
  return new Date(Math.max(t, (Number.isNaN(p) ? 0 : p) + 1)).toISOString();
}

export const store = new Store();

export function useDB(): DB {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useSaveError(): string | null {
  return useSyncExternalStore(store.subscribe, () => store.saveError);
}

// Dev only: hot-reloading this module (or anything it imports) would leave an empty store behind
// while the app still looks signed in. Reload the page instead.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
