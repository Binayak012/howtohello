import { playMistakeTone } from '../../src/answer-feedback';

type CelebrationKind = 'letter' | 'complete' | 'mistake';

export function setupTraceCelebration(root: HTMLElement, enabled = true) {
  const successAudio = new Audio('/audio/trace-success.wav');
  const completeAudio = new Audio('/audio/trace-complete.wav');
  const pencilAudio = new Audio('/audio/pencil-strokes-continuous.wav');
  pencilAudio.preload = 'auto'; pencilAudio.loop = true; pencilAudio.volume = .42;
  const soundButton = root.querySelector<HTMLButtonElement>('.trace-effects-toggle');
  let effectsMuted = false;
  try { effectsMuted = localStorage.getItem('wayword.tracing.effects-muted') === 'true'; } catch {}
  [successAudio, completeAudio].forEach(audio => { audio.preload = 'auto'; audio.volume = .34; });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const celebrated = new Set<number>();
  const timers = new Set<number>();
  let currentAudio: HTMLAudioElement | null = null;
  let pendingAudio: CelebrationKind | null = null;
  let feedbackContext: AudioContext | null = null;
  let stopMistakeTone = () => {};
  let pencilSource: MediaElementAudioSourceNode | null = null;
  let pencilGain: GainNode | null = null;
  let pencilIdleTimer: number | undefined;
  let pencilPauseTimer: number | undefined;
  let pencilPlaying = false;
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
    stopMistakeTone();
    stopMistakeTone = () => {};
  }

  function stopPencil() {
    window.clearTimeout(pencilIdleTimer);
    window.clearTimeout(pencilPauseTimer);
    pencilPlaying = false;
    if (feedbackContext && pencilGain) {
      const now = feedbackContext.currentTime;
      pencilGain.gain.cancelScheduledValues(now);
      pencilGain.gain.setTargetAtTime(0, now, .009);
      pencilPauseTimer = window.setTimeout(() => pencilAudio.pause(), 40);
    } else pencilAudio.pause();
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
    if (audioContext) stopMistakeTone = playMistakeTone(audioContext);
  }

  function pencilMoved(distance: number) {
    if (disposed || effectsMuted || pronunciationPlaying || document.hidden || distance < .35) return;
    if (pendingAudio === 'mistake') pendingAudio = null;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    stopMistake();
    const audioContext = context();
    if (!audioContext) return;
    if (!pencilSource) {
      pencilSource = audioContext.createMediaElementSource(pencilAudio);
      pencilGain = audioContext.createGain();
      pencilGain.gain.value = 0;
      pencilSource.connect(pencilGain); pencilGain.connect(audioContext.destination);
    }
    window.clearTimeout(pencilPauseTimer);
    const now = audioContext.currentTime;
    pencilGain!.gain.cancelScheduledValues(now);
    pencilGain!.gain.setTargetAtTime(.8, now, .015);
    if (audioContext.state === 'suspended') void audioContext.resume().catch(stopPencil);
    if (!pencilPlaying) {
      pencilPlaying = true;
      // Resume the real recording where the last stroke stopped, at its natural pace.
      void pencilAudio.play().then(() => {
        if (!pencilPlaying || disposed || effectsMuted) pencilAudio.pause();
      }).catch(() => { pencilPlaying = false; });
    }
    window.clearTimeout(pencilIdleTimer);
    pencilIdleTimer = window.setTimeout(stopPencil, 100);
  }

  function play(kind: CelebrationKind) {
    if (disposed || effectsMuted || document.visibilityState !== 'visible') return;
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
    if (effectsMuted) return;
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
    const portal = root.querySelector<HTMLElement>('.unit-portal') ?? root.querySelector<HTMLElement>('.trace-board');
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

  function updateSoundButton() {
    if (!soundButton) return;
    soundButton.textContent = effectsMuted ? 'Effects: Off' : 'Effects: On';
    soundButton.setAttribute('aria-pressed', String(!effectsMuted));
    soundButton.setAttribute('aria-label', effectsMuted ? 'Turn tracing sound effects on' : 'Pause tracing sound effects');
  }
  if (soundButton) soundButton.onclick = () => {
    effectsMuted = !effectsMuted;
    try { localStorage.setItem('wayword.tracing.effects-muted', String(effectsMuted)); } catch {}
    if (effectsMuted) { pendingAudio = null; stopAudio(); }
    updateSoundButton();
  };
  updateSoundButton();
  const onVisibility = () => { if (document.hidden) { pendingAudio = null; stopAudio(); } };
  document.addEventListener('visibilitychange', onVisibility);

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
      window.clearTimeout(pencilIdleTimer);
      window.clearTimeout(pencilPauseTimer);
      pencilAudio.pause();
      if (soundButton) soundButton.onclick = null;
      document.removeEventListener('visibilitychange', onVisibility);
      pencilSource?.disconnect(); pencilGain?.disconnect();
      [successAudio, completeAudio, pencilAudio].forEach(audio => {
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
