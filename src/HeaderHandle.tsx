import { useLayoutEffect, useRef, useState } from 'react';
import { cleanHandle } from '../shared/handles';
export function HeaderHandle({ name, founder }: { name: string; founder?: boolean | number }) {
  const clean = cleanHandle(name),
    ref = useRef<HTMLSpanElement>(null);
  const [label, setLabel] = useState(clean);
  useLayoutEffect(() => {
    const el = ref.current!;
    const canvas = document.createElement('canvas'),
      c = canvas.getContext('2d')!;
    const fit = () => {
      c.font = getComputedStyle(el).font;
      const words = clean.split(/\s+/);
      const options = [
        clean,
        words.map((w, i) => (i === 0 ? w[0] + '.' : w)).join(' '),
        words.map((w) => w[0] + '.').join(' '),
      ];
      setLabel(
        options.find((text) => c.measureText(text).width <= el.clientWidth) || options.at(-1)!,
      );
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    void document.fonts.ready.then(fit);
    fit();
    return () => observer.disconnect();
  }, [clean]);
  return (
    <span
      className={'header-handle' + (founder ? ' founder-handle' : '')}
      ref={ref}
      title={clean}
      aria-label={clean}
    >
      {label}
    </span>
  );
}
