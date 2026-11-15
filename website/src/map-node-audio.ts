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
    void audio.play().catch(() => { /* Chapter navigation never depends on audio support. */ });
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
