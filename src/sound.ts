import { renderDeskSound, SOUND_RATE, type DeskSound } from './sound-synthesis';
let context: AudioContext | undefined;
let active: AudioBufferSourceNode | undefined;
const played = new Set<string>();
const buffers = new Map<DeskSound, AudioBuffer>();
export function soundEnabled() {
  try {
    return localStorage.getItem('dibs-sound') !== 'off';
  } catch {
    return true;
  }
}
export async function prepareSound() {
  if (!soundEnabled()) return;
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') await context.resume();
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
  try {
    playPreparedClaimSound(kind, requestId);
  } catch {
    // Audio failure must not interrupt a successful claim or its error message.
  }
}
