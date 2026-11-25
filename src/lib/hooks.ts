import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { now, nowMs } from './time';

/** Current time, re-rendering every `everyMs`. */
export function useNow(everyMs = 1000): Date {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return t;
}

export function useNowMs(everyMs = 1000): number {
  return useNow(everyMs).getTime() || nowMs();
}

/** A UI preference kept in this browser (folds, zoom, view toggles). Not part of the race data. */
export function usePref<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const full = `iterace.pref.${key}`;
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(full);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = (next: T | ((p: T) => T)) =>
    setV((prev) => {
      const val = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try {
        localStorage.setItem(full, JSON.stringify(val));
      } catch {
        /* storage full or unavailable */
      }
      return val;
    });
  return [v, set];
}

/** Close on Escape. */
export function useEscape(onEscape: (() => void) | null) {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    if (!onEscape) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current?.();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [!!onEscape]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Tiny observable for app-wide UI state. */
export function createSignal<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: T | ((p: T) => T)) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      subs.forEach((s) => s());
    },
    use(): T {
      return useSyncExternalStore(
        (fn) => {
          subs.add(fn);
          return () => subs.delete(fn);
        },
        () => value,
      );
    },
  };
}
