import { useEffect, useState } from 'react';
export type ThemeChoice = 'system' | 'light' | 'dark';
export function themeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem('dibs-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'system';
}
function apply(choice: ThemeChoice) {
  const resolved =
    choice === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : choice;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#16150f' : '#F1ECE2');
  return resolved;
}
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(themeChoice);
  const [resolved, setResolved] = useState(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    const update = () => setResolved(apply(choice));
    update();
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    // Home-screen apps may suspend media events while backgrounded.
    document.addEventListener('visibilitychange', update);
    const storage = () => setChoice(themeChoice());
    window.addEventListener('storage', storage);
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('storage', storage);
    };
  }, [choice]);
  return {
    choice,
    resolved,
    setChoice: (next: ThemeChoice) => {
      try {
        if (next === 'system') localStorage.removeItem('dibs-theme');
        else localStorage.setItem('dibs-theme', next);
      } catch {}
      setChoice(next);
      setResolved(apply(next));
    },
  };
}
