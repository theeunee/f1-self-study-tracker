// Sign-in and data loading. With Supabase configured: email link or Google sign-in, then load the
// user's rows. Without it: local mode, data stays in this browser.
import { type ReactNode, useEffect, useState } from 'react';
import { store } from './store';
import { createLocalAdapter } from './local';
import { createSupabaseAdapter, supabase, supabaseConfigured } from './supabase';
import { buildSeed } from './seed';
import { DEFAULT_BOARD, DEFAULT_PRESETS } from '../domain/selectors';
import { now, uid } from '../lib/time';
import { Background } from '../shell/Background';

type State = { s: 'loading' } | { s: 'signin' } | { s: 'welcome' } | { s: 'ready' } | { s: 'error'; message: string };

const LOCAL_UID = 'iterace.local.uid';

function localUserId(): string {
  let id = localStorage.getItem(LOCAL_UID);
  if (!id) {
    id = uid();
    localStorage.setItem(LOCAL_UID, id);
  }
  return id;
}

export function createProfile(displayName: string) {
  const t = store.tx();
  t.insert('profiles', {
    id: store.userId,
    display_name: displayName.trim(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    session_weekday: 6,
    session_time: '19:00',
    colour_board: DEFAULT_BOARD,
    length_presets: DEFAULT_PRESETS,
  });
  t.commit();
}

export function loadSample(displayName: string) {
  store.replaceAll(buildSeed(store.userId, displayName.trim() || 'Driver', now()));
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  window.location.reload();
}

/** Account deletion removes every row (brief §3). */
export async function deleteAccount() {
  if (supabase) {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw new Error(error.message);
    await supabase.auth.signOut();
  } else {
    localStorage.removeItem('iterace.local.db.v1');
    localStorage.removeItem(LOCAL_UID);
  }
  window.location.reload();
}

export const isLocalMode = !supabaseConfigured;

export function Gate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ s: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const boot = async (userId: string, meta: { name?: string }) => {
      try {
        const adapter = supabase ? createSupabaseAdapter(supabase) : createLocalAdapter(() => store.db);
        await store.init(adapter, userId);
        if (cancelled) return;
        if (!store.db.profiles.length) {
          if (supabase && meta.name) {
            createProfile(meta.name);
            setState({ s: 'ready' });
          } else setState({ s: 'welcome' });
        } else setState({ s: 'ready' });
      } catch (e) {
        setState({ s: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    };
    if (!supabase) {
      boot(localUserId(), {});
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u) boot(u.id, { name: (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) });
      else setState({ s: 'signin' });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user && !store.ready) {
        const u = session.user;
        boot(u.id, { name: (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) });
      }
      if (event === 'SIGNED_OUT') setState({ s: 'signin' });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state.s === 'ready') return <>{children}</>;
  return (
    <div className="gate">
      <Background raceNumber={null} />
      <div className="gate-card glass">
        <span className="display gate-mark">ITERACE</span>
        {state.s === 'loading' && <p className="muted">Warming up the tyres…</p>}
        {state.s === 'error' && (
          <>
            <p>Couldn’t load your data.</p>
            <p className="error-text">{state.message}</p>
            <button className="btn btn-solid" onClick={() => window.location.reload()}>
              TRY AGAIN
            </button>
          </>
        )}
        {state.s === 'signin' && <SignIn />}
        {state.s === 'welcome' && <Welcome onDone={() => setState({ s: 'ready' })} />}
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: err } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) setError(err.message);
    else setSent(true);
  };
  const google = async () => {
    const { error: err } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (err) setError(err.message);
  };
  if (sent)
    return (
      <>
        <h1 className="gate-title">Check your inbox</h1>
        <p>We sent a sign-in link to {email}. Open it on this device.</p>
      </>
    );
  return (
    <>
      <h1 className="gate-title">Sign in to start your race</h1>
      <form onSubmit={send} className="field">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-red" type="submit">
          SEND SIGN-IN LINK
        </button>
      </form>
      <div className="gate-or label">or</div>
      <button className="btn btn-solid" type="button" onClick={google}>
        CONTINUE WITH GOOGLE
      </button>
      {error && <p className="error-text">{error}</p>}
    </>
  );
}

function Welcome({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  return (
    <>
      <h1 className="gate-title">What should your race engineer call you?</h1>
      <input
        className="input"
        aria-label="Your name"
        placeholder="Your name"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />
      <div className="gate-actions">
        <button
          className="btn btn-red"
          disabled={!name.trim()}
          onClick={() => {
            createProfile(name);
            onDone();
          }}
        >
          START EMPTY
        </button>
        {isLocalMode && (
          <button
            className="btn btn-outline"
            disabled={!name.trim()}
            onClick={() => {
              loadSample(name);
              onDone();
            }}
          >
            LOAD SAMPLE DATA
          </button>
        )}
      </div>
      {isLocalMode && (
        <p className="gate-note">
          Local mode: no Supabase project is set up yet, so everything stays in this browser.
        </p>
      )}
    </>
  );
}
