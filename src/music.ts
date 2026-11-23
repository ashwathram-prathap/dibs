// Create the media element only after a tap; decoding streams as bytes arrive.
let context: AudioContext | undefined;
let gain: GainNode | undefined;
let audio: HTMLAudioElement | undefined;
let wanted = false;
const level = 0.3;
function ramp(value: number, seconds = 0.08) {
  if (!context || !gain) return;
  gain.gain.cancelScheduledValues(context.currentTime);
  gain.gain.setTargetAtTime(value, context.currentTime, seconds / 3);
}
function setup() {
  if (audio) return;
  context = new AudioContext();
  audio = new Audio();
  audio.preload = 'none';
  audio.loop = true;
  audio.setAttribute('playsinline', '');
  audio.src = audio.canPlayType('audio/webm; codecs="opus"')
    ? '/audio/waiting-room.v2.webm'
    : '/audio/waiting-room.v2.m4a';
  gain = context.createGain();
  gain.gain.value = level;
  context.createMediaElementSource(audio).connect(gain);
  gain.connect(context.destination);
  context.addEventListener('statechange', () => {
    if (wanted && !document.hidden && (context!.state as string) === 'interrupted')
      void context!.resume();
  });
  audio.addEventListener('pause', () => {
    if (wanted && !document.hidden)
      void context!
        .resume()
        .then(() => audio!.play())
        .catch(() => {});
  });
}
export async function setMusic(on: boolean) {
  wanted = on;
  if (!on) {
    audio?.pause();
    return;
  }
  setup();
  if ('audioSession' in navigator) (navigator as any).audioSession.type = 'playback';
  // Both calls begin synchronously inside the user's gesture on Safari.
  const resumed = context!.resume();
  const playing = audio!.play();
  await Promise.all([resumed, playing]);
  if (!wanted) audio!.pause();
  else ramp(level);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio?.pause();
  else if (wanted)
    void context
      ?.resume()
      .then(() => audio?.play())
      .catch(() => {});
});
window.addEventListener('dibs-stamp', ((event: CustomEvent<number>) => {
  if (!wanted || !gain || !context) return;
  ramp(level * 0.15, 0.006);
  gain.gain.setTargetAtTime(level, context.currentTime + event.detail, 0.25);
}) as EventListener);
