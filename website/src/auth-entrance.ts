/** A small entrance on arrival; tab switches keep the existing form mounted. */
export function setupAuthEntrance(): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const animations: Animation[] = [];
  function reveal(selector: string, delay: number, y: number, duration: number) {
    const element = document.querySelector(selector);
    if (!element) return;
    animations.push(element.animate([
      { opacity: 0, transform: `translateY(${y}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration, delay, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'backwards' }));
  }
  reveal('.auth-story', 0, 10, 550);
  reveal('.auth-card', 80, 14, 650);
  reveal('.auth-footer', 150, 4, 450);
  // Stop layout motion before the pen measures a newly focused field.
  function settle(event: FocusEvent) {
    if (event.target instanceof Element && event.target.closest('#auth-form')) {
      animations.forEach(animation => animation.finish());
    }
  }
  document.addEventListener('focusin', settle, true);
  return () => {
    document.removeEventListener('focusin', settle, true);
    animations.forEach(animation => animation.cancel());
  };
}
