// A circular progress ring with the percentage in the centre. Hand-written SVG (shadcn has no
// ring). Decorative: the text equivalent lives on the container. The arc is primary, or success
// green once everything is done.
export function ProgressRing({ done, total, size = 56 }: { done: number; total: number; size?: number }) {
  const percent = total > 0 ? Math.floor((done / total) * 100) : 0;
  const finished = total > 0 && done === total;
  const stroke = Math.max(3, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span aria-hidden className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (total > 0 ? done / total : 0))}
          className={finished ? "stroke-success" : "stroke-primary"}
        />
      </svg>
      <span
        className={`absolute font-semibold tabular-nums ${finished ? "text-success" : "text-heading"}`}
        style={{ fontSize: Math.max(10, Math.round(size / 4.2)) }}
      >
        {percent}%
      </span>
    </span>
  );
}
