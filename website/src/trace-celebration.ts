type CelebrationKind = 'letter' | 'complete' | 'mistake';

export function setupTraceCelebration(root: HTMLElement, enabled = true) {
  const successAudio = new Audio('/audio/trace-success.wav');
  const completeAudio = new Audio('/audio/trace-complete.wav');
  [successAudio, completeAudio].forEach(audio => { audio.preload = 'auto'; audio.volume = .34; });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const celebrated = new Set<number>();
  const timers = new Set<number>();
  let currentAudio: HTMLAudioElement | null = null;
  let pendingAudio: CelebrationKind | null = null;
  let feedbackContext: AudioContext | null = null;
  let mistakeMaster: GainNode | null = null;
  let mistakeVoices: OscillatorNode[] = [];
  let scratchSource: AudioBufferSourceNode | null = null;
  let scratchGain: GainNode | null = null;
  let scratchIdleTimer: number | undefined;
  let pronunciationPlaying = false;
  let completed = false;
  let disposed = false;

  function later(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timers.add(timer);
  }

  function context() {
    try {
      feedbackContext ??= new AudioContext();
      return feedbackContext;
    } catch {
      return null;
    }
  }

  function stopMistake() {
    if (!feedbackContext || !mistakeMaster) return;
    const now = feedbackContext.currentTime;
    mistakeMaster.gain.cancelScheduledValues(now);
    mistakeMaster.gain.setValueAtTime(0, now);
    mistakeVoices.forEach(voice => { try { voice.stop(now); } catch { /* Already ended. */ } });
    mistakeVoices = [];
    mistakeMaster = null;
  }

  function stopPencil() {
    window.clearTimeout(scratchIdleTimer);
    scratchIdleTimer = undefined;
    if (!feedbackContext || !scratchSource || !scratchGain) return;
    const source = scratchSource;
    const gain = scratchGain;
    const now = feedbackContext.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    try { source.stop(now); } catch { /* Already stopped. */ }
    scratchSource = null;
    scratchGain = null;
  }

  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    stopPencil();
    stopMistake();
  }

  function playMistake() {
    const audioContext = context();
    if (!audioContext) return;
    const master = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = .45;
    master.gain.value = .12;
    filter.connect(master);
    master.connect(audioContext.destination);
    mistakeMaster = master;
    const start = audioContext.currentTime + .012;
    const wave = audioContext.createPeriodicWave(
      new Float32Array([0, 1, .16, .04]),
      new Float32Array(4),
      { disableNormalization: false },
    );
    [[329.63, 0, .29], [277.18, .18, .30]].forEach(([frequency, offset, duration]) => {
      const voice = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      voice.setPeriodicWave(wave);
      voice.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, start + offset);
      envelope.gain.linearRampToValueAtTime(.32, start + offset + .028);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + offset + duration);
      voice.connect(envelope);
      envelope.connect(filter);
      voice.start(start + offset);
      voice.stop(start + offset + duration + .02);
      mistakeVoices.push(voice);
    });
    void audioContext.resume().catch(() => { stopMistake(); });
    later(() => {
      if (mistakeMaster === master) {
        mistakeMaster = null;
        mistakeVoices = [];
      }
    }, 540);
  }

  function pencilMoved(distance: number) {
    if (disposed || pronunciationPlaying || document.visibilityState !== 'visible' || distance < .35) return;
    if (pendingAudio === 'mistake') pendingAudio = null;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    stopMistake();
    const audioContext = context();
    if (!audioContext) return;
    if (!scratchSource || !scratchGain) {
      const source = audioContext.createBufferSource();
      const sampleCount = Math.ceil(audioContext.sampleRate * .18);
      const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const grain = Math.random() * 2 - 1;
        samples[i] = grain * (.38 + Math.random() * .18);
      }
      const paper = audioContext.createBiquadFilter();
      const softener = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      paper.type = 'bandpass'; paper.frequency.value = 820; paper.Q.value = .55;
      softener.type = 'lowpass'; softener.frequency.value = 1650; softener.Q.value = .35;
      gain.gain.value = 0;
      source.buffer = buffer;
      source.loop = true;
      source.connect(paper); paper.connect(softener); softener.connect(gain); gain.connect(audioContext.destination);
      source.onended = () => { source.disconnect(); paper.disconnect(); softener.disconnect(); gain.disconnect(); };
      source.start();
      scratchSource = source;
      scratchGain = gain;
    }
    const now = audioContext.currentTime;
    const volume = Math.min(.026, .012 + distance * .0012);
    scratchGain.gain.cancelScheduledValues(now);
    scratchGain.gain.setTargetAtTime(volume, now, .012);
    void audioContext.resume().catch(stopPencil);
    window.clearTimeout(scratchIdleTimer);
    scratchIdleTimer = window.setTimeout(stopPencil, 70);
  }

  function play(kind: CelebrationKind) {
    if (disposed || document.visibilityState !== 'visible') return;
    stopAudio();
    if (kind === 'mistake') {
      playMistake();
      return;
    }
    const audio = kind === 'complete' ? completeAudio : successAudio;
    currentAudio = audio;
    audio.currentTime = 0;
    void audio.play().catch(() => { if (currentAudio === audio) currentAudio = null; });
  }

  function requestAudio(kind: CelebrationKind) {
    if (pronunciationPlaying) {
      if (kind === 'complete' || pendingAudio !== 'complete') pendingAudio = kind;
      return;
    }
    play(kind);
  }

  function letterVisual(index: number) {
    const letter = root.querySelector<HTMLElement>('#trace-title span');
    const board = root.querySelector<HTMLElement>('.trace-board');
    const tile = root.querySelector<HTMLElement>(`[data-code="${index}"]`);
    letter?.classList.add('is-letter-accepted');
    board?.classList.add('is-letter-accepted');
    if (tile) {
      tile.classList.add('is-earned');
      const sparkles = document.createElement('span');
      sparkles.className = 'passcode-sparkles';
      sparkles.setAttribute('aria-hidden', 'true');
      sparkles.innerHTML = '<i>✦</i><i>✧</i><i>✦</i>';
      tile.append(sparkles);
      later(() => sparkles.remove(), 1100);
    }
    later(() => {
      letter?.classList.remove('is-letter-accepted');
      board?.classList.remove('is-letter-accepted');
      tile?.classList.remove('is-earned');
    }, motion.matches ? 700 : 1100);
  }

  function finalVisual() {
    const portal = root.querySelector<HTMLElement>('.unit-portal');
    if (!portal) return;
    portal.classList.add(motion.matches ? 'is-final-highlight' : 'is-final-celebration');
    let confetti: HTMLDivElement | undefined;
    if (!motion.matches) {
      confetti = document.createElement('div');
      confetti.className = 'door-confetti';
      confetti.setAttribute('aria-hidden', 'true');
      const pieces = [
        [-44,-16,-18],[-32,-42,12],[-15,-55,-8],[5,-52,20],[25,-48,-12],[43,-25,16],
        [48,4,-20],[38,30,10],[19,42,-14],[-4,48,18],[-26,39,-10],[-43,20,14],
        [-52,2,-16],[13,-33,8],[-12,-31,-6],[30,9,12],[-31,7,-12],[3,27,16],
      ];
      confetti.innerHTML = pieces.map(([x,y,r], index) =>
        `<i style="--x:${x}px;--y:${y}px;--r:${r}deg;--delay:${index % 4 * 35}ms"></i>`).join('');
      portal.append(confetti);
    }
    later(() => {
      portal.classList.remove('is-final-celebration', 'is-final-highlight');
      confetti?.remove();
    }, 1900);
  }

  function acceptLetter(index: number, isFinal: boolean) {
    if (!enabled || disposed || celebrated.has(index)) return;
    celebrated.add(index);
    letterVisual(index);
    if (isFinal) {
      if (completed) return;
      completed = true;
      finalVisual();
      requestAudio('complete');
    } else {
      requestAudio('letter');
    }
  }

  function completeWithKeyboard() {
    if (!enabled || disposed || completed) return;
    completed = true;
    root.querySelectorAll<HTMLElement>('[data-code]').forEach(tile => tile.classList.add('is-done'));
    finalVisual();
    requestAudio('complete');
  }

  return {
    acceptLetter,
    completeWithKeyboard,
    pencilMoved,
    stopPencil,
    mistake() {
      if (!disposed) requestAudio('mistake');
    },
    setPronunciationPlaying(playing: boolean) {
      if (disposed || pronunciationPlaying === playing) return;
      pronunciationPlaying = playing;
      if (playing) {
        stopAudio();
        return;
      }
      if (pendingAudio) {
        const kind = pendingAudio;
        pendingAudio = null;
        play(kind);
      }
    },
    dispose() {
      disposed = true;
      pendingAudio = null;
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      stopAudio();
      [successAudio, completeAudio].forEach(audio => {
        audio.removeAttribute('src');
        audio.load();
      });
      void feedbackContext?.close().catch(() => {});
      feedbackContext = null;
      root.querySelectorAll('.passcode-sparkles,.door-confetti').forEach(element => element.remove());
      root.querySelectorAll('.is-letter-accepted,.is-earned,.is-final-celebration,.is-final-highlight').forEach(element =>
        element.classList.remove('is-letter-accepted', 'is-earned', 'is-final-celebration', 'is-final-highlight'));
    },
  };
}
