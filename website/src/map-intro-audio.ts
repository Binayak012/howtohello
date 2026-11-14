let stopActiveMapIntro: (() => void) | undefined;

/**
 * Plays the map's short welcome once per visit. If autoplay is denied, the
 * first eligible interaction retries it without adding UI to the map.
 */
export function setupMapIntroAudio(): () => void {
  stopActiveMapIntro?.();

  const audio = new Audio('/audio/map-intro.wav');
  audio.preload = 'auto';
  audio.volume = .2;
  let stopped = false;
  let playing = false;
  let attemptInFlight = false;
  let retryPending = document.visibilityState !== 'visible';

  function destinationFrom(event: Event): HTMLAnchorElement | null {
    const target = event.target;
    return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
  }

  function removeListeners() {
    document.removeEventListener('pointerdown', onInteraction, true);
    document.removeEventListener('keydown', onInteraction, true);
    document.removeEventListener('click', onDeparture, true);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', stop);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    retryPending = false;
    removeListeners();
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
    if (stopActiveMapIntro === stop) stopActiveMapIntro = undefined;
  }

  async function play() {
    if (stopped || playing || attemptInFlight || document.visibilityState !== 'visible') return;
    attemptInFlight = true;
    try {
      audio.currentTime = 0;
      await audio.play();
      playing = true;
      retryPending = false;
      document.removeEventListener('pointerdown', onInteraction, true);
      document.removeEventListener('keydown', onInteraction, true);
    } catch (error) {
      retryPending = error instanceof DOMException && error.name === 'NotAllowedError';
    } finally {
      attemptInFlight = false;
    }
  }

  function onInteraction(event: Event) {
    if (destinationFrom(event)) {
      stop();
      return;
    }
    if (event instanceof KeyboardEvent && ['Tab', 'Escape', 'Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return;
    if (retryPending) void play();
  }

  function onDeparture(event: Event) {
    if (destinationFrom(event)) stop();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') stop();
  }

  document.addEventListener('pointerdown', onInteraction, true);
  document.addEventListener('keydown', onInteraction, true);
  document.addEventListener('click', onDeparture, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', stop);
  stopActiveMapIntro = stop;

  if (document.visibilityState === 'visible') void play();
  return stop;
}

/** Gives every chapter-number node a quiet wooden response. */
export function setupMapNodeClickAudio(): () => void {
  const audio = new Audio('/audio/map-node-click.wav');
  audio.preload = 'auto';
  audio.volume = .24;
  let stopped = false;

  function play() {
    if (stopped || document.visibilityState !== 'visible') return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => { /* Click behavior never depends on audio support. */ });
  }

  function nodeFrom(event: Event) {
    const target = event.target;
    return target instanceof Element ? target.closest('.level-node') : null;
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button === 0 && nodeFrom(event)) play();
  }

  function onKeyDown(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && nodeFrom(event)) play();
  }

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  return () => {
    if (stopped) return;
    stopped = true;
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
}
