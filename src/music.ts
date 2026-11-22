import { musicLoopBounds } from './music-loop';
// AudioContext and the MP3 are created/loaded only from a Music tap.
let context: AudioContext | undefined;
let gain: GainNode | undefined;
let source: AudioBufferSourceNode | undefined;
let buffer: AudioBuffer | undefined;
let loading: Promise<void> | undefined;
let wanted = false;
let revision = 0;
let pausedAt = 0;
let beganAt = 0;
let pauseTimer: ReturnType<typeof setTimeout> | undefined;
function ramp(value: number, seconds = 1) {
  if (!gain || !context) return;
  gain.gain.cancelAndHoldAtTime(context.currentTime);
  gain.gain.linearRampToValueAtTime(value, context.currentTime + seconds);
}
function start() {
  if (!context || !buffer || !gain || source || !wanted || document.hidden) return;
  source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const loop = musicLoopBounds(buffer.duration);
  source.loopStart = loop.start;
  source.loopEnd = loop.end;
  source.connect(gain);
  beganAt = context.currentTime;
  source.start(0, loop.start + (pausedAt % 32));
  ramp(1);
}
function stop() {
  if (!source || !context) return;
  pausedAt = (pausedAt + context.currentTime - beganAt) % 32;
  source.stop();
  source.disconnect();
  source = undefined;
}
export async function setMusic(on: boolean) {
  wanted = on;
  const current = ++revision;
  clearTimeout(pauseTimer);
  if (!on) {
    ramp(0);
    pauseTimer = setTimeout(stop, 1000);
    return;
  }
  context ||= new AudioContext();
  gain ||= context.createGain();
  // Resume while still in the tap, before fetching/decoding.
  await context.resume();
  if (!loading) {
    gain.gain.value = 0;
    gain.connect(context.destination);
    loading = fetch('/audio/waiting-room.mp3')
      .then((r) => {
        if (!r.ok) throw Error('Music unavailable');
        return r.arrayBuffer();
      })
      .then((bytes) => context!.decodeAudioData(bytes))
      .then((decoded) => {
        buffer = decoded;
      })
      .catch((e) => {
        loading = undefined;
        throw e;
      });
  }
  await loading;
  if (current === revision && wanted) {
    start();
    if (!document.hidden) ramp(1);
  }
}
document.addEventListener('visibilitychange', () => {
  clearTimeout(pauseTimer);
  if (document.hidden) {
    ramp(0, 0.05);
    pauseTimer = setTimeout(stop, 60);
  } else if (wanted) {
    void context?.resume().then(() => {
      start();
      ramp(1);
    });
  }
});
window.addEventListener('dibs-stamp', ((event: CustomEvent<number>) => {
  if (!source || !gain || !context || !wanted) return;
  const at = context.currentTime;
  gain.gain.cancelAndHoldAtTime(at);
  gain.gain.linearRampToValueAtTime(0.2, at + 0.006);
  gain.gain.setValueAtTime(0.2, at + event.detail);
  gain.gain.linearRampToValueAtTime(1, at + event.detail + 1);
}) as EventListener);
