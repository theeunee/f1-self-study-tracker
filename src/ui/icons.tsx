// Small stroke icons used across pages (shapes taken from the designs).
type P = { size?: number; className?: string };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});
export const IconX = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={3}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconPlus = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={3.5}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={3.5}>
    <path d="M5 12h14" />
  </svg>
);
export const IconCheck = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={4}>
    <path d="M5 12l5 5 9-10" />
  </svg>
);
export const IconEdit = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={2.5}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
  </svg>
);
export const IconChevron = ({ size = 12, dir = 'down' }: P & { dir?: 'down' | 'up' | 'left' | 'right' }) => {
  const r = { down: 0, up: 180, left: 90, right: -90 }[dir];
  return (
    <svg {...base(size)} strokeWidth={3} style={{ transform: `rotate(${r}deg)` }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
};
export const IconDoubleChevron = ({ size = 14, dir = 'left' }: P & { dir?: 'left' | 'right' }) => (
  <svg {...base(size)} strokeWidth={2.5} style={{ transform: dir === 'right' ? 'rotate(180deg)' : undefined }}>
    <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
  </svg>
);
export const IconCamera = ({ size = 18 }: P) => (
  <svg width={size} height={(size * 16) / 18} viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
    <path d="M2 6h14v10H2z" />
    <path d="M16 9l6-3v10l-6-3" />
  </svg>
);
export const IconSwap = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2.5}>
    <path d="M4 8h14l-4-4M20 16H6l4 4" />
  </svg>
);
export const IconFilter = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={2.5}>
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </svg>
);
export const IconLock = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={2.5}>
    <rect x="5" y="11" width="14" height="10" rx="1" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);
export const IconClock = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2.5}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconGrip = ({ size = 12 }: P) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden fill="currentColor">
    {[2, 6, 10].flatMap((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />))}
  </svg>
);
export const Flag = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 4 4" aria-hidden shapeRendering="crispEdges">
    <rect width="4" height="4" fill="#fff" />
    {[0, 1, 2, 3].flatMap((y) => [0, 1, 2, 3].filter((x) => (x + y) % 2 === 0).map((x) => <rect key={`${x}${y}`} x={x} y={y} width="1" height="1" fill="#111" />))}
  </svg>
);
