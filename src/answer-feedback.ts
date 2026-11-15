/** The same gentle descending tone used for tracing mistakes. */
export function playMistakeTone(context: AudioContext): () => void {
  return playAnswerTone(context, false);
}

function playAnswerTone(context: AudioContext, correct: boolean): () => void {
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = .45;
  master.gain.value = .12;
  filter.connect(master);
  master.connect(context.destination);
  const start = context.currentTime + .012;
  const wave = context.createPeriodicWave(new Float32Array([0, 1, .16, .04]), new Float32Array(4), { disableNormalization: false });
  const voices: OscillatorNode[] = [];
  let remaining = 2;
  const stop = () => {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
    voices.forEach(voice => { try { voice.stop(); } catch { /* Already ended. */ } });
  };
  const notes = correct ? [[523.25, 0, .16], [659.25, .10, .23]] : [[329.63, 0, .29], [277.18, .18, .30]];
  notes.forEach(([frequency, offset, duration]) => {
    const voice = context.createOscillator();
    const envelope = context.createGain();
    voice.setPeriodicWave(wave);
    voice.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start + offset);
    envelope.gain.linearRampToValueAtTime(.32, start + offset + .028);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + offset + duration);
    voice.connect(envelope);
    envelope.connect(filter);
    voice.onended = () => {
      voice.disconnect(); envelope.disconnect();
      if (--remaining === 0) { filter.disconnect(); master.disconnect(); }
    };
    voice.start(start + offset);
    voice.stop(start + offset + duration + .02);
    voices.push(voice);
  });
  void context.resume().catch(stop);
  return stop;
}

/** Short ascending and descending tones; no applause or celebration recording. */
export function createAnswerFeedback(enabled: () => boolean) {
  let context: AudioContext | undefined;
  let stopMistake = () => {};
  const stop = () => {
    stopMistake(); stopMistake = () => {};
  };
  const onVisibility = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', onVisibility);
  return {
    play(correct: boolean) {
      stop();
      if (!enabled() || document.hidden) return;
      try { context ??= new AudioContext(); stopMistake = playAnswerTone(context, correct); } catch { /* Audio is optional. */ }
    },
    stop,
    dispose() {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      void context?.close().catch(() => {});
    },
  };
}
