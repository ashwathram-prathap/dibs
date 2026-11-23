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
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 3v10M8 3v10M12 3v10M2 11l12-6" />
      </svg>
      <strong>{value}</strong>
      <span className="streak-caption">day streak</span>
    </span>
  );
}
