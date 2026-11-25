import { createSignal } from '../lib/hooks';

/** The Undo toast keeps only the last change (brief §6 Shared shell). */
export const toastSignal = createSignal<{ id: number; text: string; logId: string | null } | null>(null);
let seq = 0;
export function showToast(text: string, logId: string | null = null) {
  toastSignal.set({ id: ++seq, text, logId });
}

export const radioOpen = createSignal(false);
export const pitStopOpen = createSignal(false);
export const briefOpen = createSignal(false);
/** Race week's Mechanics-mode draft, so the radio can show unsaved changes with a SAVE button. */
export const draftSignal = createSignal<{ count: number; lines: string[]; save: () => void } | null>(null);
