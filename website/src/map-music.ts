/** Original nostalgic menu loop: music-box melody, warm retro pads, and swaying arpeggios. */
const preferenceKey = 'wayword.map-music';
const beatSeconds = 60 / 68;
const chords = [[130.81,164.81,196,246.94], [110,130.81,164.81,196], [130.81,174.61,220,261.63], [98,146.83,196,246.94]];
const melody = new Map([[0,329.63],[1,392],[3,493.88],[5,440],[6,392],[8,329.63],[10,293.66],[12,261.63],[14,329.63],[16,349.23],[18,440],[20,392],[22,329.63],[24,293.66],[26,392],[28,329.63],[30,261.63]]);

export function setupMapMusic(button: HTMLButtonElement): () => void {
  let desired = true;
  try { desired = localStorage.getItem(preferenceKey) !== 'off'; } catch { /* Optional preference. */ }
  let disposed = false;
  let engine: { context: AudioContext; master: GainNode; timer: number; voices: Set<OscillatorNode> } | null = null;
  function update() {
    const playing = desired && engine?.context.state === 'running' && !document.hidden;
    button.setAttribute('aria-pressed', String(!!playing));
    button.setAttribute('aria-label', playing ? 'Pause map music' : 'Play peaceful map music');
    button.title = playing ? 'Pause map music' : 'Play peaceful map music';
    button.classList.toggle('is-playing', !!playing);
    button.querySelector('.map-music-label')!.textContent = playing ? 'Music on' : 'Play music';
  }
  function remember() { try { localStorage.setItem(preferenceKey, desired ? 'on' : 'off'); } catch { /* Optional preference. */ } }
  function start() {
    if (disposed || !desired) return;
    if (engine) { void engine.context.resume().then(update).catch(update); return; }
    let context: AudioContext;
    try { context = new AudioContext(); } catch { button.disabled = true; button.title = 'Music is unavailable in this browser'; return; }
    const master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    const tone = context.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2500; tone.Q.value = .4; tone.connect(master);
    // A short stereo room softens the spaces between notes without a long wash.
    const room = context.createConvolver();
    const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 1.8), context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 2.7);
    }
    room.buffer = impulse;
    const wet = context.createGain(); wet.gain.value = .25;
    tone.connect(room); room.connect(wet); wet.connect(master);
    const voices = new Set<OscillatorNode>();
    let step = 0, next = .08;
    function note(frequency: number, time: number, duration: number, volume: number, attack: number, pan = 0, type: OscillatorType = 'sine', detune = 0, sustain = false) {
      const voice = context.createOscillator(), envelope = context.createGain(), position = context.createStereoPanner();
      voice.type = type; voice.frequency.value = frequency; voice.detune.value = detune;
      position.pan.value = pan;
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(volume, time + attack);
      if (sustain) envelope.gain.setValueAtTime(volume * .85, time + duration * .64);
      envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
      voice.connect(envelope); envelope.connect(position); position.connect(tone); voices.add(voice);
      voice.onended = () => { voices.delete(voice); voice.disconnect(); envelope.disconnect(); position.disconnect(); };
      voice.start(time); voice.stop(time + duration + .02);
    }
    function schedule() {
      if (context.state !== 'running' || document.hidden) return;
      if (next < context.currentTime) next = context.currentTime + .08;
      while (next < context.currentTime + .3) {
        const position = step % 64;
        const chord = chords[Math.floor(position / 16)];
        if (position % 16 === 0) chord.forEach((frequency, i) => {
          // Overlapping, lightly detuned voices create a warm held chord.
          const duration = beatSeconds * 8 + 1.4;
          note(frequency, next + i * .045, duration, .034, 1.15, -.25, 'sine', -3, true);
          note(frequency, next + i * .045, duration, .023, 1.25, .25, 'triangle', 4, true);
        });
        // The tempo stays relaxed while half-beat notes provide continuous flow.
        const harpOrder = [0, 2, 1, 3, 2, 1, 0, 2];
        const harpFrequency = chord[harpOrder[position % harpOrder.length]] * 2;
        const swayingTime = next + (position % 2 ? .045 : 0);
        note(harpFrequency, swayingTime, 1.8, .045, .055, Math.sin(position * .7) * .24, 'triangle');
        note(harpFrequency * 2, swayingTime, .65, .007, .035, Math.sin(position * .7) * .24);
        const frequency = position % 2 === 0 ? melody.get(position / 2) : undefined;
        if (frequency) {
          // A small, bell-like melody recalls a cozy old adventure-game menu.
          note(frequency, next, 2.3, .12, .035, .08, 'triangle');
          note(frequency * 2, next, 1.4, .022, .025, -.12);
          note(frequency * 3, next, .5, .004, .018, .12);
        }
        step++; next += beatSeconds / 2;
      }
    }
    const timer = window.setInterval(schedule, 150);
    engine = { context, master, timer, voices };
    context.onstatechange = update;
    master.gain.setTargetAtTime(.13, context.currentTime, .55);
    void context.resume().then(() => { if (!disposed) { schedule(); update(); } }).catch(update);
    schedule(); update();
  }
  function stop() {
    const previous = engine;
    engine = null;
    if (!previous) return;
    clearInterval(previous.timer);
    previous.context.onstatechange = null;
    previous.master.gain.cancelScheduledValues(previous.context.currentTime);
    previous.master.gain.setTargetAtTime(0, previous.context.currentTime, .08);
    window.setTimeout(() => {
      previous.voices.forEach(voice => { try { voice.stop(); } catch { /* Already ended. */ } });
      void previous.context.close().catch(() => {});
    }, 400);
    update();
  }
  button.onclick = () => {
    if (engine?.context.state === 'running' && desired) { desired = false; stop(); }
    else { desired = true; start(); }
    remember(); update();
  };
  function unlock(event: Event) {
    if (event.target instanceof Element && event.target.closest('.map-music,a[href]')) return;
    if (desired && !document.hidden && engine?.context.state !== 'running') start();
  }
  function visibility() {
    if (!engine) return;
    if (document.hidden) void engine.context.suspend().catch(() => {});
    else if (desired) void engine.context.resume().then(update).catch(update);
    update();
  }
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', visibility);
  if (desired && !document.hidden) start();
  update();
  return () => {
    disposed = true; stop(); button.onclick = null;
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('visibilitychange', visibility);
  };
}

export const mapMusicButton = `<button type="button" class="map-music" aria-label="Play peaceful map music" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/></svg><span class="map-music-label">Play music</span></button>`;
