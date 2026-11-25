// Edge Function `calendar`: a small proxy for read-only calendar sync (brief §3).
// Browsers can't fetch Google/Apple private iCal links directly, and the links are secrets, so they are
// stored and fetched only here, with the service role. The browser never sees an ics_url.
//
// POST { action: 'add', provider, name, ics_url }   → { id }
// POST { action: 'remove', id }                      → { ok }
// POST { action: 'events', from, to, tz }            → { events: [{ uid, source_id, source_name, title, start, end }] }
//
// Deploy: supabase functions deploy calendar
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseIcs } from '../_shared/ics.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  if (body.action === 'add') {
    const url = String(body.ics_url ?? '').trim().replace(/^webcal:\/\//i, 'https://');
    if (!/^https:\/\//i.test(url)) return json({ error: 'Use the https (or webcal) iCal link from your calendar settings.' }, 400);
    // Check it really is a calendar before saving it.
    const probe = await fetch(url, { headers: { Accept: 'text/calendar' } }).catch(() => null);
    const text = probe && probe.ok ? await probe.text() : '';
    if (!text.includes('BEGIN:VCALENDAR')) return json({ error: 'That link didn’t return a calendar.' }, 400);
    const provider = ['google', 'apple', 'other'].includes(String(body.provider)) ? String(body.provider) : 'other';
    const { data, error } = await admin
      .from('calendar_sources')
      .insert({ user_id: user.id, provider, name: String(body.name ?? 'Calendar').slice(0, 60), ics_url: url })
      .select('id')
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ id: data.id });
  }

  if (body.action === 'remove') {
    const { error } = await admin.from('calendar_sources').delete().eq('id', String(body.id)).eq('user_id', user.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === 'events') {
    const from = new Date(String(body.from));
    const to = new Date(String(body.to));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() - from.getTime() > 120 * 86400000) return json({ error: 'bad range' }, 400);
    const tz = typeof body.tz === 'string' ? body.tz : 'UTC';
    const { data: sources, error } = await admin.from('calendar_sources').select('id,name,ics_url').eq('user_id', user.id);
    if (error) return json({ error: error.message }, 400);
    const events = (
      await Promise.all(
        (sources ?? []).map(async (s) => {
          try {
            const res = await fetch(s.ics_url, { headers: { Accept: 'text/calendar' } });
            if (!res.ok) return [];
            return parseIcs(await res.text(), from, to, tz)
              .filter((e) => !e.allDay)
              .map((e) => ({ uid: e.uid, source_id: s.id, source_name: s.name, title: e.title, start: e.start, end: e.end }));
          } catch {
            return [];
          }
        }),
      )
    ).flat();
    return json({ events });
  }

  return json({ error: 'unknown action' }, 400);
});
