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
type GainPoint = { at: number; value: number };
let envelope: GainPoint[] = [{ at: 0, value: 0 }];
function gainAt(at: number) {
  let previous = envelope[0];
  for (const point of envelope.slice(1)) {
    if (at < point.at)
      return (
        previous.value +
        (point.value - previous.value) * Math.max(0, (at - previous.at) / (point.at - previous.at))
      );
    previous = point;
  }
  return previous.value;
}
function automate(points: GainPoint[]) {
  if (!gain || !context) return;
  const at = context.currentTime,
    value = gainAt(at);
  // Keep the scheduled value ourselves: Firefox has no cancelAndHoldAtTime.
  gain.gain.cancelScheduledValues(at);
  gain.gain.setValueAtTime(value, at);
  envelope = [{ at, value }, ...points];
  for (const point of points) gain.gain.linearRampToValueAtTime(point.value, point.at);
}
function ramp(value: number, seconds = 1) {
  if (context) automate([{ at: context.currentTime + seconds, value }]);
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
  const ducked = Math.min(0.2, gainAt(at));
  automate([
    { at: at + 0.006, value: ducked },
    { at: at + event.detail, value: ducked },
    { at: at + event.detail + 1, value: 1 },
  ]);
}) as EventListener);
