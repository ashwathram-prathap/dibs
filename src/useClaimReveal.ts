import { useEffect, useRef, useState } from 'react';
export function useClaimReveal(day?: string) {
  const [phase, setPhase] = useState('done');
  const mounted = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    seen = useRef(new Set<string>()),
    sound = useRef<(() => void) | null>(null);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const finish = () => {
    clear();
    sound.current?.();
    sound.current = null;
    setPhase('done');
  };
  const begin = (id: string, onStamp: () => void) => {
    if (!mounted.current) return;
    clear();
    sound.current = null;
    if (seen.current.has(id)) {
      setPhase('done');
      return;
    }
    seen.current.add(id);
    if (seen.current.size > 32) seen.current.delete(seen.current.values().next().value!);
    if (document.hidden) {
      setPhase('done');
      return;
    }
    sound.current = onStamp;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    setPhase('hold');
    for (const [at, next] of [
      [250, 'stamp'],
      [550, 'rarity'],
      [1150, 'tier'],
      [1350, 'points'],
      [1600, 'done'],
    ] as const)
      timers.current.push(
        setTimeout(() => {
          if (next === 'stamp') {
            sound.current?.();
            sound.current = null;
          }
          setPhase(next);
        }, at),
      );
  };
  useEffect(() => {
    mounted.current = true;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => {
      if (media.matches) finish();
    };
    const hidden = () => {
      if (document.hidden) {
        clear();
        sound.current = null;
        setPhase('done');
      }
    };
    media.addEventListener('change', reduce);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      mounted.current = false;
      clear();
      sound.current = null;
      media.removeEventListener('change', reduce);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [day]);
  return { phase, begin, finish };
}
