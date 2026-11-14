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
  let mistakeContext: AudioContext | null = null;
  let mistakeMaster: GainNode | null = null;
  let mistakeVoices: OscillatorNode[] = [];
  let pronunciationPlaying = false;
  let completed = false;
  let disposed = false;

  function later(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timers.add(timer);
  }

  function stopMistake() {
    if (!mistakeContext || !mistakeMaster) return;
    const now = mistakeContext.currentTime;
    mistakeMaster.gain.cancelScheduledValues(now);
    mistakeMaster.gain.setValueAtTime(0, now);
    mistakeVoices.forEach(voice => { try { voice.stop(now); } catch { /* Already ended. */ } });
    mistakeVoices = [];
    mistakeMaster = null;
  }

  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    stopMistake();
  }

  function playMistake() {
    try {
      mistakeContext ??= new AudioContext();
    } catch {
      return;
    }
    const context = mistakeContext;
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = .45;
    master.gain.value = .12;
    filter.connect(master);
    master.connect(context.destination);
    mistakeMaster = master;
    const start = context.currentTime + .012;
    const wave = context.createPeriodicWave(
      new Float32Array([0, 1, .16, .04]),
      new Float32Array(4),
      { disableNormalization: false },
    );
    [[329.63, 0, .29], [277.18, .18, .30]].forEach(([frequency, offset, duration]) => {
      const voice = context.createOscillator();
      const envelope = context.createGain();
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
    void context.resume().catch(() => { stopMistake(); });
    later(() => {
      if (mistakeMaster === master) {
        mistakeMaster = null;
        mistakeVoices = [];
      }
    }, 540);
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
      void mistakeContext?.close().catch(() => {});
      mistakeContext = null;
      root.querySelectorAll('.passcode-sparkles,.door-confetti').forEach(element => element.remove());
      root.querySelectorAll('.is-letter-accepted,.is-earned,.is-final-celebration,.is-final-highlight').forEach(element =>
        element.classList.remove('is-letter-accepted', 'is-earned', 'is-final-celebration', 'is-final-highlight'));
    },
  };
}
