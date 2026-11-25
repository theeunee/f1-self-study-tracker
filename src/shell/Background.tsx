// The race-track artwork behind every page (from the designs), with the race number in the corner.
export function Background({ raceNumber }: { raceNumber: number | null }) {
  const d =
    'M160 700 C110 560 200 440 350 440 L720 440 C820 440 860 370 840 290 C820 210 880 140 980 150 L1220 180 C1320 194 1340 300 1280 370 L1160 500 C1100 570 1130 650 1210 690 C1290 730 1270 830 1170 830 L300 830 C230 830 185 780 160 700 Z';
  return (
    <div className="bg" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        {raceNumber != null && (
          <text x="760" y="880" className="bg-num">
            {String(raceNumber).padStart(2, '0')}
          </text>
        )}
        <path d={d} className="bg-track" />
        <path d={d} className="bg-track-dash" />
        <rect x="-80" y="250" width="1000" height="80" className="bg-bar" transform="rotate(-8 400 290)" />
      </svg>
    </div>
  );
}
