/** Decorative direction vocabulary; independent of playable language packs. */
const vocabulary = [
  { lang: 'en', label: 'English', up: 'up', down: 'down' },
  { lang: 'ko', label: '한국어', up: '위로', down: '아래로' },
  { lang: 'es', label: 'Español', up: 'arriba', down: 'abajo' },
  { lang: 'ja', label: '日本語', up: '上へ', down: '下へ' },
  { lang: 'fr', label: 'Français', up: 'en haut', down: 'en bas' },
  { lang: 'zh-Hans', label: '中文', up: '向上', down: '向下' },
  { lang: 'it', label: 'Italiano', up: 'su', down: 'giù' },
];

export function startScrollWords(): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');
  layer.className = 'scroll-words';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const active = new Set<Animation>();
  let lastY = window.scrollY;
  let distance = 0;
  let direction = 0;
  let lastSpawn = -Infinity;
  let wordIndex = 0;
  let lastLanguage = '';
  let remainingWords: typeof vocabulary = [];

  function nextWord() {
    if (!remainingWords.length) {
      // Shuffle a fresh bag: every language appears before the next round.
      remainingWords = [...vocabulary];
      for (let i = remainingWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingWords[i], remainingWords[j]] = [remainingWords[j], remainingWords[i]];
      }
      // The bag is consumed from the end. Avoid repeats across round boundaries.
      const last = remainingWords.length - 1;
      if (remainingWords[last].lang === lastLanguage) {
        [remainingWords[0], remainingWords[last]] = [remainingWords[last], remainingWords[0]];
      }
    }
    const word = remainingWords.pop()!;
    lastLanguage = word.lang;
    return word;
  }

  function onScroll() {
    const y = Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - innerHeight));
    const delta = y - lastY;
    lastY = y;
    if (reducedMotion.matches || document.hidden || Math.abs(delta) < 1) return;
    const nextDirection = Math.sign(delta);
    if (nextDirection !== direction) distance = 0;
    direction = nextDirection;
    distance += Math.abs(delta);
    const now = performance.now();
    if (distance < 36 || now - lastSpawn < 240 || active.size >= 6) return;
    distance = 0;
    lastSpawn = now;
    const word = nextWord();
    wordIndex++;
    const down = direction > 0;
    const particle = document.createElement('span');
    particle.className = `scroll-word scroll-word--${wordIndex % 4}`;
    particle.lang = word.lang;
    const arrow = document.createElement('span');
    arrow.className = 'scroll-word-arrow';
    arrow.textContent = down ? '↓' : '↑';
    const text = document.createElement('span');
    text.className = 'scroll-word-text';
    text.textContent = down ? word.down : word.up;
    const label = document.createElement('small');
    label.textContent = word.label;
    particle.append(arrow, text, label);
    layer.append(particle);

    // Fan into the viewport; downward words start higher so they have room to fall.
    const startY = down ? -170 : -12;
    const travel = down ? 125 : -165;
    const x = -10 - Math.random() * 20;
    const drift = -45 - Math.random() * 90;
    const tilt = (Math.random() - .5) * 16;
    const animation = particle.animate([
      { opacity: 0, transform: `translate(${x}px, ${startY}px) scale(.65) rotate(${tilt - 5}deg)` },
      { opacity: .95, transform: `translate(${x + drift * .15}px, ${startY + travel * .15}px) scale(1) rotate(${tilt}deg)`, offset: .15 },
      { opacity: .9, offset: .68 },
      { opacity: 0, transform: `translate(${x + drift}px, ${startY + travel}px) scale(.92) rotate(${tilt + 6}deg)` },
    ], { duration: 2300, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' });
    active.add(animation);
    const remove = () => { active.delete(animation); particle.remove(); };
    animation.onfinish = remove;
    animation.oncancel = remove;
  }
  function clear() {
    for (const animation of active) animation.cancel();
    active.clear();
    layer.replaceChildren();
    distance = 0;
    lastY = window.scrollY;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  reducedMotion.addEventListener('change', clear);
  document.addEventListener('visibilitychange', clear);
  return () => {
    window.removeEventListener('scroll', onScroll);
    reducedMotion.removeEventListener('change', clear);
    document.removeEventListener('visibilitychange', clear);
    clear();
    layer.remove();
  };
}
