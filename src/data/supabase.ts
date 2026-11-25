// Supabase adapter. Only the anon key reaches the browser; Row Level Security limits every
// query to the signed-in user's rows (supabase/migrations/0001_init.sql).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Adapter, Change } from './store';
import { type TableName, TABLES, emptyDB } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(url && anon);
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url!, anon!) : null;

// Columns the client is allowed to read. calendar_sources.ics_url is a secret and is never selected.
const SELECT: Partial<Record<TableName, string>> = {
  calendar_sources: 'id,user_id,created_at,updated_at,provider,name',
};

export function createSupabaseAdapter(client: SupabaseClient): Adapter {
  return {
    kind: 'supabase',
    async load() {
      const db = emptyDB();
      await Promise.all(
        TABLES.map(async (t) => {
          const { data, error } = await client.from(t).select(SELECT[t] ?? '*');
          if (error) throw new Error(`${t}: ${error.message}`);
          (db as Record<string, unknown[]>)[t] = data ?? [];
        }),
      );
      return db;
    },
    async write(changes: Change[]) {
      // Parents before children for upserts; children before parents for deletes.
      const upserts = changes.filter((c) => c.op === 'upsert');
      const deletes = changes.filter((c) => c.op === 'delete');
      for (const t of [...TABLES].reverse()) {
        const ids = deletes.filter((c) => c.table === t).map((c) => c.row.id);
        if (ids.length) {
          const { error } = await client.from(t).delete().in('id', ids);
          if (error) throw new Error(`${t}: ${error.message}`);
        }
      }
      for (const t of TABLES) {
        const rows = upserts.filter((c) => c.table === t).map((c) => c.row);
        if (rows.length) {
          const { error } = await client.from(t).upsert(rows);
          if (error) throw new Error(`${t}: ${error.message}`);
        }
      }
    },
  };
}
