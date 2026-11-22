let context: AudioContext | undefined;
export function soundEnabled() {
  try {
    return localStorage.getItem('dibs-sound') !== 'off';
  } catch {
    return true;
  }
}
export async function prepareSound() {
  if (!soundEnabled()) return;
  context ||= new AudioContext();
  if (context.state === 'suspended') await context.resume();
}
export function stampSound(win: boolean, gold = false) {
  if (!soundEnabled() || !context || context.state !== 'running') return;
  const oscillator = context.createOscillator(),
    gain = context.createGain(),
    at = context.currentTime;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(win ? 140 : 100, at);
  oscillator.frequency.exponentialRampToValueAtTime(45, at + 0.09);
  gain.gain.setValueAtTime(win ? 0.1 : 0.045, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + 0.13);
}

export function goldSound() {
  if (!soundEnabled() || !context || context.state !== 'running') return;
  const o = context.createOscillator(),
    g = context.createGain(),
    t = context.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(880, t);
  o.frequency.setValueAtTime(1320, t + 0.09);
  g.gain.setValueAtTime(0.025, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g);
  g.connect(context.destination);
  o.start(t);
  o.stop(t + 0.26);
}
