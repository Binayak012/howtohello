/** Original, quiet music-box phrase. No audio files or third-party requests. */
const preferenceKey = 'wayword.transition-muted';
export function transitionMuted(): boolean {
  try { return localStorage.getItem(preferenceKey) === 'true'; } catch { return false; }
}
export function rememberTransitionMuted(muted: boolean) {
  try { localStorage.setItem(preferenceKey, String(muted)); } catch { /* Optional preference. */ }
}
export function playTransitionTune(muted: boolean) {
  let context: AudioContext;
  try { context = new AudioContext(); } catch { return null; }
  const master = context.createGain();
  master.gain.value = muted ? 0 : .12;
  master.connect(context.destination);
  const start = context.currentTime + .035;
  const voices: OscillatorNode[] = [];
  let stopped = false;
  function note(frequency: number, offset: number, duration: number, volume: number) {
    const voice = context.createOscillator();
    const envelope = context.createGain();
    voice.type = 'sine'; voice.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start + offset);
    envelope.gain.linearRampToValueAtTime(volume, start + offset + .025);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + offset + duration);
    voice.connect(envelope); envelope.connect(master);
    voice.start(start + offset); voice.stop(start + offset + duration + .02);
    voices.push(voice);
  }
  // Restore the original light music-box melody and gentle harmonic shimmer.
  const melody = [[523.25,0], [659.25,.24], [783.99,.48], [880,.72], [783.99,1.02], [659.25,1.27], [587.33,1.52], [523.25,1.8]];
  melody.forEach(([frequency, offset], i) => {
    const duration = i === melody.length - 1 ? .55 : .38;
    note(frequency, offset, duration, .23);
    note(frequency * 2, offset, duration * .6, .035);
  });
  note(261.63, 0, 1.9, .07); note(329.63, .04, 1.85, .045);
  // Invoked synchronously by the initiating click or valid form submission.
  void context.resume().catch(() => { /* Animation/navigation do not depend on audio permission. */ });
  function setMuted(value: boolean) {
    if (stopped) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(value ? 0 : .12, now, .035);
    if (!value) void context.resume().catch(() => {});
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0, now, .025);
    window.setTimeout(() => {
      voices.forEach(voice => { try { voice.stop(); } catch { /* Already ended. */ } });
      void context.close().catch(() => {});
    }, 120);
  }
  return { setMuted, stop };
}
