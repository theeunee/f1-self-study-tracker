// The colour board (brief §6 Race week): eight defaults plus custom colours. Hover a swatch to remove
// it; + adds one with react-colorful. Shared by goals, lap blocks and the goal form.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { store, useDB } from '../data/store';
import { addBoardColor, removeBoardColor } from '../domain/goals';
import { DEFAULT_BOARD } from '../domain/selectors';
import { useEscape } from '../lib/hooks';
import { IconPlus, IconX } from './icons';

export function useBoard(): string[] {
  const db = useDB();
  return db.profiles[0]?.colour_board ?? DEFAULT_BOARD;
}

export function Swatches({
  value,
  onPick,
  removable = true,
  label = 'Colour',
}: {
  value: string | null;
  onPick: (hex: string) => void;
  removable?: boolean;
  label?: string;
}) {
  const board = useBoard();
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(value ?? '#E10600');
  return (
    <div className="swatches-wrap">
      <div className="swatches" role="group" aria-label={label}>
        {board.map((hex) => (
          <span key={hex} className="swatch-chip">
            <button
              type="button"
              className="swatch"
              style={{ background: hex }}
              aria-label={`Colour ${hex}`}
              aria-pressed={value?.toUpperCase() === hex.toUpperCase()}
              onClick={() => onPick(hex)}
            />
            {removable && board.length > 1 && (
              <button type="button" className="swatch-x" aria-label={`Remove ${hex} from the board`} onClick={() => removeBoardColor(store, hex)}>
                <IconX size={8} />
              </button>
            )}
          </span>
        ))}
        <button type="button" className="swatch swatch-add" aria-label="Pick a custom colour" aria-expanded={custom} onClick={() => setCustom((c) => !c)}>
          <IconPlus size={12} />
        </button>
      </div>
      {custom && (
        <div className="custom-colour">
          <HexColorPicker color={draft} onChange={setDraft} />
          <div className="custom-colour-row">
            <span className="dot" style={{ background: draft, width: 22, height: 22 }} />
            <HexColorInput className="input mono-input" color={draft} onChange={setDraft} prefixed aria-label="Hex colour" />
            <button
              type="button"
              className="btn btn-sm btn-solid"
              onClick={() => {
                addBoardColor(store, draft);
                onPick(draft.toUpperCase());
                setCustom(false);
              }}
            >
              SAVE COLOUR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Floating colour picker anchored to an element. */
export function ColourPopover({
  anchor,
  title,
  value,
  onPick,
  onClose,
}: {
  anchor: HTMLElement | null;
  title: string;
  value: string | null;
  onPick: (hex: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useEscape(onClose);
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = 300;
    const left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left));
    const top = Math.min(window.innerHeight - 380, r.bottom + 8);
    setPos({ left, top });
  }, [anchor]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [anchor, onClose]);
  return (
    <div ref={ref} className="popover colour-pop" role="dialog" aria-label={title} style={{ position: 'fixed', ...pos }}>
      <span className="label">{title}</span>
      <Swatches
        value={value}
        onPick={(hex) => {
          onPick(hex);
          onClose();
        }}
      />
    </div>
  );
}
