import { useEffect, useRef, useState } from 'react';
export const streakMilestone = (n: number) => [3, 7, 30, 100].includes(n);
export function StreakChip({ value }: { value: number }) {
  const last = useRef(value);
  const [tick, setTick] = useState(false);
  useEffect(() => {
    if (value > last.current) {
      setTick(true);
      const timer = setTimeout(() => setTick(false), 300);
      last.current = value;
      return () => clearTimeout(timer);
    }
    last.current = value;
  }, [value]);
  return (
    <span
      className={
        'streak-chip' +
        (!value ? ' streak-zero' : '') +
        (streakMilestone(value) ? ' streak-milestone' : '') +
        (tick ? ' streak-tick' : '')
      }
      aria-label={`${value} day streak`}
    >
      {value > 0 && (
        <svg viewBox="0 0 20 16" aria-hidden="true">
          {['M4 3L3 13', 'M8 2L7 13', 'M12 3L11 14', 'M16 2L15 13']
            .slice(0, Math.min(value, 4))
            .map((d) => (
              <path key={d} d={d} />
            ))}
          {value >= 5 && <path d="M1 12L18 4" />}
        </svg>
      )}
      <strong>{value}</strong>
      <span className="streak-caption">day streak</span>
    </span>
  );
}
