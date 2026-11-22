let context: AudioContext | undefined;
export function soundEnabled() {
  try {
    return localStorage.getItem('dibs-sound') === 'on';
  } catch {
    return false;
  }
}
export async function prepareSound() {
  if (!soundEnabled()) return;
  context ||= new AudioContext();
  if (context.state === 'suspended') await context.resume();
}
export function stampSound(win: boolean) {
  if (!soundEnabled() || !context || context.state !== 'running') return;
  const oscillator = context.createOscillator(),
    gain = context.createGain(),
    at = context.currentTime;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(win ? 140 : 100, at);
  oscillator.frequency.exponentialRampToValueAtTime(45, at + 0.09);
  gain.gain.setValueAtTime(win ? 0.18 : 0.08, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + 0.13);
}
