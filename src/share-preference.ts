import { useState } from 'react';
export function useHideAnswers() {
  const [hide, setHide] = useState(() => {
    try {
      return localStorage.getItem('dibs-hide-answers') === 'true';
    } catch {
      return false;
    }
  });
  return [
    hide,
    (value: boolean) => {
      setHide(value);
      try {
        localStorage.setItem('dibs-hide-answers', String(value));
      } catch {}
    },
  ] as const;
}
