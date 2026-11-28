import { useEffect, useState } from 'react';
import { api } from './api';
import type { Me, Today } from './types';
import { Link } from './ui';
const dismissed = new Set<string>();
export function PreviousNight({ me, today }: { me: Me; today: Today }) {
  const identity = me.user?.id,
    scope = identity + ':' + (today.category?.date || today.nextDrop);
  const [data, setData] = useState<any>(null),
    [hidden, setHidden] = useState('');
  useEffect(() => {
    setData(null);
    setHidden('');
    if (!identity || me.firstVisit) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const read = async (retry = false) => {
      try {
        const d: any = await api('/previous');
        if (stopped) return;
        if (d?.pending && !retry) {
          timer = setTimeout(() => void read(true), 60000);
          return;
        }
        if (!d?.ready) return;
        const key = 'dibs-recap:' + identity + ':' + d.category.date;
        let seen = dismissed.has(key);
        try {
          seen ||= localStorage.getItem(key) === '1';
        } catch {}
        if (!seen) setData({ ...d, key, scope });
      } catch {}
    };
    void read();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [scope]);
  if (!data || data.scope !== scope || hidden === data.key) return null;
  const dismiss = () => {
    dismissed.add(data.key);
    if (dismissed.size > 8) dismissed.delete(dismissed.values().next().value!);
    try {
      localStorage.setItem(data.key, '1');
    } catch {}
    setHidden(data.key);
  };
  return (
    <aside className="previous-night" aria-label="Yesterday's reveal">
      <details>
        <summary>
          Yesterday: {data.file.rank ? `#${data.file.rank} of ${data.file.players}` : 'your file'} ·
          see the reveal
        </summary>
        <h2>{data.category.name}</h2>
        <p>{data.file.points} points · final</p>
        <ul>
          {data.file.claims.map((c: any) => (
            <li key={c.id}>
              {c.display} · {c.points} points{c.golden ? ' · Golden ticket' : ''}
            </li>
          ))}
        </ul>
        <h3>Golden tickets</h3>
        <ul>
          {data.goldens.map((g: any) => (
            <li key={g.display}>
              {g.display} · {g.finder}
            </li>
          ))}
        </ul>
        <Link to={'/archive?date=' + data.category.date}>Full board and reveal</Link>
      </details>
      <button onClick={dismiss} aria-label="Dismiss yesterday's reveal">
        Dismiss
      </button>
    </aside>
  );
}
