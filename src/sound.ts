import { renderDeskSound, SOUND_RATE, type DeskSound } from './sound-synthesis';
let context: AudioContext | undefined;
let preparing: Promise<void> | undefined;
let active: AudioBufferSourceNode | undefined;
const played = new Set<string>();
const buffers = new Map<DeskSound, AudioBuffer>();
let sessionEnabled: boolean | undefined;
export function soundEnabled() {
  if (sessionEnabled !== undefined) return sessionEnabled;
  try {
    return localStorage.getItem('dibs-sound') !== 'off';
  } catch {
    return true;
  }
}
export function setSoundEnabled(on: boolean) {
  sessionEnabled = on;
  try {
    localStorage.setItem('dibs-sound', on ? 'on' : 'off');
  } catch {}
}
export async function prepareSound() {
  if (!soundEnabled()) return;
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') {
      preparing = context.resume();
      await preparing;
    }
  } catch {
    /* Audio support must never prevent a claim. */
  }
}
function playPreparedClaimSound(kind: DeskSound | null, requestId: string) {
  if (!kind || !soundEnabled() || !context || context.state !== 'running' || played.has(requestId))
    return;
  played.add(requestId);
  if (played.size > 64) played.delete(played.values().next().value!);
  if (active) return; // Never layer copies, even if two responses arrive together.
  let buffer = buffers.get(kind);
  if (!buffer) {
    const samples = renderDeskSound(kind);
    buffer = context.createBuffer(1, samples.length, SOUND_RATE);
    buffer.copyToChannel(samples, 0);
    buffers.set(kind, buffer);
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  active = source;
  source.onended = () => {
    source.disconnect();
    if (active === source) active = undefined;
  };
  window.dispatchEvent(new CustomEvent('dibs-stamp', { detail: buffer.duration }));
  source.start();
}

export function playClaimSound(kind: DeskSound | null, requestId: string) {
  // Muted results must never become queued sounds when audio startup finishes.
  if (!kind || !soundEnabled()) return;
  const play = () => {
    try {
      playPreparedClaimSound(kind, requestId);
    } catch {
      // Audio failure must not interrupt a claim or its error message.
    }
  };
  if (context?.state === 'suspended' && preparing) {
    // A fast response can precede device startup. Wait for the original gesture
    // without delaying the claim; the normal guards still prevent overlap.
    void preparing.then(play).catch(() => {});
  } else play();
}
