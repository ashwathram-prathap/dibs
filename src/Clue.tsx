import { useState } from 'react';
import type { Specials } from './types';
export function Clue({ clue }: { clue?: Specials['clue'] }) {
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState(false);
  if (!clue) return null;
  const text = 'Dibs, ' + clue.text[0].toLowerCase() + clue.text.slice(1) + ' dibs.here';
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage('Copied');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        setMessage('Copied');
      } catch {
        setManual(true);
      }
    }
  };
  return (
    <div className="golden-clue">
      <p>{clue.text}</p>
      {clue.crackedBy && <p>Cracked by {clue.crackedBy}.</p>}
      <button onClick={() => void share()}>Share tonight’s clue</button>
      <span role="status">{message}</span>
      {manual && (
        <textarea
          readOnly
          value={text}
          aria-label="Clue to copy"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  );
}
