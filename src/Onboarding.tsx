import { useEffect, useRef, useState } from 'react';
import type { Me, Today } from './types';
import { serverNow } from './clock';
import { MAX_CLAIMS, MAX_STRIKES } from '../shared/config';
let presented = false;
const key = 'dibs-how-to-play-seen';
function canPresent() {
  if (presented) return false;
  try {
    return localStorage.getItem(key) !== '1';
  } catch {
    return false;
  }
}
export function Onboarding({
  me,
  today,
  path,
}: {
  me: Me | null;
  today: Today | null;
  path: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    previous = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const boundary = today?.category?.id || 'closed';
  const close = () => {
    setOpen(false);
    ref.current?.close();
    const input = document.querySelector<HTMLInputElement>('#answer:not(:disabled)');
    if (path === '/' && input) input.focus({ preventScroll: true });
    else previous.current?.focus({ preventScroll: true });
  };
  const show = () => {
    presented = true;
    try {
      localStorage.setItem(key, '1');
    } catch {}
    previous.current = document.activeElement as HTMLElement;
    setOpen(true);
  };
  useEffect(() => {
    if (
      path === '/' &&
      me?.firstVisit &&
      today &&
      !me.file?.dibs &&
      !me.file?.strikes &&
      canPresent()
    )
      show();
  }, [me?.firstVisit, today != null, path]);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
  }, [open]);
  useEffect(() => {
    if (open) close();
  }, [boundary, path]);
  useEffect(() => {
    if (!open || !today) return;
    const ms = Date.parse(today.nextDrop) - serverNow();
    if (ms <= 0) {
      close();
      return;
    }
    const id = setTimeout(close, ms);
    return () => clearTimeout(id);
  }, [open, today?.nextDrop]);
  useEffect(() => {
    const reopen = () => show();
    window.addEventListener('dibs-how-to-play', reopen);
    return () => window.removeEventListener('dibs-how-to-play', reopen);
  }, []);
  return (
    <dialog
      ref={ref}
      className="onboarding-dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
        }
      }}
      onCancel={close}
      onClose={() => {
        if (!ref.current?.open) setOpen(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            close();
        }
      }}
    >
      <h2 id="onboarding-title">How to play</h2>
      <p>One category a night. Name something in it.</p>
      <p>If nobody has it, it's yours, and rarer answers score more.</p>
      <p>
        {MAX_CLAIMS} claims. Taken or reserved guesses cost a strike ({MAX_STRIKES} max). Typos
        never do.
      </p>
      <button className="primary" autoFocus onClick={close}>
        Let's play
      </button>
    </dialog>
  );
}
