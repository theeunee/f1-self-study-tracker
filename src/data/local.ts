// Browser-only storage, used when no Supabase project is configured (development and demos).
import type { Adapter, Change } from './store';
import { type DB, TABLES, emptyDB } from './types';

const KEY = 'iterace.local.db.v1';

export function readLocal(): DB | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DB>;
    const db = emptyDB();
    for (const t of TABLES) if (Array.isArray(parsed[t])) (db as Record<string, unknown[]>)[t] = parsed[t] as unknown[];
    return db;
  } catch {
    return null;
  }
}

export function createLocalAdapter(getDB: () => DB): Adapter {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    localStorage.setItem(KEY, JSON.stringify(getDB()));
  };
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => timer && flush());
  return {
    kind: 'local',
    async load() {
      return readLocal() ?? emptyDB();
    },
    async write(_changes: Change[]) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 150);
    },
  };
}

export function clearLocal() {
  localStorage.removeItem(KEY);
}
