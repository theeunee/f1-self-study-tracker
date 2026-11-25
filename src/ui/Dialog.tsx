import { type ReactNode, useEffect, useRef } from 'react';
import { useEscape } from '../lib/hooks';

/** Modal dialog with focus moved in, Esc to close, and focus restored on close. */
export function Dialog({
  label,
  onClose,
  children,
  className = '',
  width,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[autofocus], input, textarea, button');
    first?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`dialog ${className}`}
        style={width ? { width: `min(${width}px, calc(100vw - 48px))` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  kicker,
  title,
  body,
  confirmLabel,
  cancelLabel = 'CANCEL',
  danger,
  extra,
  onConfirm,
  onCancel,
}: {
  kicker: string;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  extra?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog label={title} onClose={onCancel} width={520}>
      <span className="label label-red">{kicker}</span>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      <div className="dialog-actions">
        {extra}
        <button className="btn btn-outline" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className={`btn ${danger ? 'btn-red' : 'btn-solid'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
