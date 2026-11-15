/** Decorative script samples, not a list of playable language packs. */
const letters: Record<string, string[]> = {
  ne: ['अ', 'आ', 'इ', 'ई', 'उ', 'क', 'म', 'न'],
  es: ['A', 'Ñ', 'E', 'Ó', 'Í', 'Ú', 'O', 'U'],
  fr: ['A', 'É', 'È', 'Ç', 'À', 'Œ', 'O', 'U'],
  ko: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅏ', 'ㅓ', 'ㅗ'],
  ja: ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'さ'],
  'zh-Hans': ['学', '文', '你', '好', '山', '水', '日', '月'],
  it: ['A', 'E', 'I', 'O', 'U', 'C', 'P', 'L'],
  en: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
};

export function burstLanguageLetters(dialog: HTMLDialogElement, language: string): () => void {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const glyphs = [...(letters[language] ?? letters.en)];
  if (motion.matches) return () => {};
  // A manual popover shares the browser's top layer with the dialog. This keeps
  // letters sharp, above the blurred backdrop, and outside the card's scroll box.
  const layer = document.createElement('div');
  if (typeof layer.showPopover !== 'function') return () => {};
  layer.setAttribute('popover', 'manual');
  layer.setAttribute('aria-hidden', 'true');
  layer.className = 'mode-letter-particles';
  dialog.append(layer);
  try { layer.showPopover(); } catch { layer.remove(); return () => {}; }
  const animations: Animation[] = [];
  const bounds = dialog.getBoundingClientRect();
  const cx = bounds.left + bounds.width / 2;
  const cy = bounds.top + bounds.height / 2;
  const small = innerWidth < 600;
  const count = small ? 8 : 12;
  // Shuffle each burst, including repeat visits to the same language.
  for (let i = glyphs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [glyphs[i], glyphs[j]] = [glyphs[j], glyphs[i]];
  }
  for (let i = 0; i < count; i++) {
    const angle = (i + .25 + Math.random() * .35) / count * Math.PI * 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const radius = Math.min((bounds.width / 2 + 6) / Math.max(.001, Math.abs(dx)), (bounds.height / 2 + 6) / Math.max(.001, Math.abs(dy)));
    const x = Math.max(20, Math.min(innerWidth - 20, cx + dx * radius));
    const y = Math.max(25, Math.min(innerHeight - 25, cy + dy * radius));
    const particle = document.createElement('span');
    particle.className = `mode-letter mode-letter-${i % 4}`;
    particle.lang = language;
    particle.textContent = glyphs[i % glyphs.length];
    particle.style.left = `${x}px`; particle.style.top = `${y}px`;
    particle.style.fontSize = `${(small ? 14 : 17) + Math.random() * 4}px`;
    layer.append(particle);
    const travel = (small ? 26 : 55) + Math.random() * 35;
    const endX = Math.max(19 - x, Math.min(innerWidth - 19 - x, dx * travel));
    const endY = Math.max(25 - y, Math.min(innerHeight - 25 - y, dy * travel - 22));
    const tilt = (Math.random() - .5) * 24;
    animations.push(particle.animate([
      { opacity: 0, transform: `translate(-50%,-50%) scale(.35) rotate(${tilt - 8}deg)` },
      { opacity: .55, transform: `translate(calc(-50% + ${endX * .2}px),calc(-50% + ${endY * .2}px)) scale(1.06) rotate(${tilt}deg)`, offset: .2 },
      { opacity: .4, offset: .58 },
      { opacity: 0, transform: `translate(calc(-50% + ${endX}px),calc(-50% + ${endY}px)) scale(.85) rotate(${tilt + 12}deg)` },
    ], { duration: 1550 + Math.random() * 350, delay: 70 + i * 40, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' }));
  }
  function clear() {
    animations.forEach(animation => animation.cancel());
    try { layer.hidePopover(); } catch { /* Already removed or closed. */ }
    layer.remove();
    motion.removeEventListener('change', clear);
  }
  motion.addEventListener('change', clear);
  void Promise.allSettled(animations.map(animation => animation.finished)).then(clear);
  return clear;
}
