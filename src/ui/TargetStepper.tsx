// − / + or type a duration: 5, 4.5, 4h 30m, 4:30 (brief §6 Goals detail).
import { useState } from 'react';
import { fmtDur, parseDuration } from '../lib/time';

export function TargetStepper({
  value,
  onChange,
  step = 30,
  min = 30,
  label = 'Weekly target',
}: {
  value: number;
  onChange: (min: number) => void;
  step?: number;
  min?: number;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const commit = () => {
    const v = parseDuration(text);
    if (v != null && v >= min) onChange(Math.min(6000, v));
    setEditing(false);
  };
  return (
    <div className="stepper">
      <button type="button" className="stepper-btn" aria-label={`Lower the ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      {editing ? (
        <input
          className="stepper-input"
          autoFocus
          aria-label={label}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="stepper-value"
          title="Click to type a target"
          aria-label={`${label}: ${fmtDur(value)}. Click to type.`}
          onClick={() => {
            setText(fmtDur(value));
            setEditing(true);
          }}
        >
          {fmtDur(value)}
        </button>
      )}
      <button type="button" className="stepper-btn" aria-label={`Raise the ${label.toLowerCase()}`} onClick={() => onChange(value + step)}>
        +
      </button>
    </div>
  );
}
