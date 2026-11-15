import './language-modes.css';
import { burstLanguageLetters } from './language-particles';
import { readLearningHistory, recordLanguageStarted, type LearningHistory } from '../../src/learning-history';
import { completedLevels } from '../../src/progression';

const languages = [
  { id: 'ne', native: 'नेपाली', english: 'Nepali', flag: '🇳🇵', available: true },
  { id: 'es', native: 'Español', english: 'Spanish', flag: '🇪🇸', available: false },
  { id: 'fr', native: 'Français', english: 'French', flag: '🇫🇷', available: false },
  { id: 'ko', native: '한국어', english: 'Korean', flag: '🇰🇷', available: false },
  { id: 'ja', native: '日本語', english: 'Japanese', flag: '🇯🇵', available: false },
  { id: 'zh-Hans', native: '中文', english: 'Mandarin Chinese', flag: '🇨🇳', available: false },
  { id: 'it', native: 'Italiano', english: 'Italian', flag: '🇮🇹', available: false },
  { id: 'en', native: 'English', english: 'English', flag: '🇬🇧', available: false },
];

const soloIcon = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="10" r="5"/><path d="M7 27v-3a9 9 0 0 1 18 0v3M11 27h10"/></svg>';
const multiplayerIcon = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="12" cy="10" r="4"/><path d="M4 26v-3a8 8 0 0 1 16 0v3M21 6a4 4 0 1 1 0 8m3 4a7 7 0 0 1 4 6v2"/></svg>';

export function renderLanguages(app: HTMLDivElement, brand: string) {
  document.documentElement.classList.add('language-selection-screen');
  let history: LearningHistory = { started: [], lastLanguage: null };
  try {
    history = readLearningHistory(localStorage);
    if (!history.started.includes('ne') && completedLevels(localStorage).length) {
      recordLanguageStarted(localStorage, 'ne');
      history = readLearningHistory(localStorage);
    }
  } catch { /* Language selection also works without browser storage. */ }
  const lastLanguage = languages.find(language => language.available && language.id === history.lastLanguage)
    ?? languages.find(language => language.available && history.started.includes(language.id));
  const hasStarted = (id: string) => history.started.includes(id);
  app.innerHTML = `<a class="skip" href="#languages-main">Skip to content</a>
  <header class="nav wrap">${brand}<a class="back-link" href="/">← Back to home</a></header>
  <main id="languages-main" class="language-page language-mode-page wrap">
    <div class="language-heading"><p class="eyebrow">NEW WORDS. NEW WORLDS.</p><h1>Where will your<br><span>adventure begin?</span></h1><p>Pick a language, then choose how you’d like to play.</p></div>
    ${lastLanguage ? `<section class="language-resume" aria-label="Resume learning"><span class="resume-flag" aria-hidden="true">${lastLanguage.flag}</span><div><strong>Pick up where you left off</strong><p>${lastLanguage.english} · Single player</p></div><button class="button primary" id="resume-learning" type="button">Continue where you left off <span aria-hidden="true">↗</span></button></section>` : ''}
    <form id="language-form" class="language-mode-layout">
      <fieldset class="language-options"><legend class="sr-only">Choose your learning language</legend>
      ${languages.map(language => `<label class="language-option"><input type="radio" name="language" value="${language.id}" ${language.id === lastLanguage?.id ? 'checked' : ''} required aria-describedby="language-note-${language.id}"><span class="language-card"><span class="language-flag" aria-hidden="true">${language.flag}</span><span class="language-check" aria-hidden="true">✓</span><span class="language-native" lang="${language.id}">${language.native}</span><span class="language-english">${language.english}</span><span id="language-note-${language.id}" class="language-badge ${language.available ? 'is-playable' : ''}">${language.available ? (hasStarted(language.id) ? 'Continue learning' : 'Ready to play') : 'Coming soon'}</span></span></label>`).join('')}
      </fieldset>
      <dialog class="play-mode-panel play-mode-dialog" id="play-mode-dialog" aria-labelledby="mode-dialog-title">
        <button type="button" class="mode-close" id="mode-close" aria-label="Close play options"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button>
        <div class="language-modes" id="language-modes">
          <div class="mode-language"><span id="mode-flag" aria-hidden="true"></span><div><span id="mode-native"></span><small id="mode-english"></small></div></div>
          <p class="eyebrow">CHOOSE YOUR WAY TO PLAY</p><h2 id="mode-dialog-title">How will you play?</h2>
          <button type="submit" class="play-mode-choice single-player-choice" id="language-continue" disabled aria-describedby="single-player-description"><span class="play-mode-icon">${soloIcon}</span><span class="play-mode-copy"><strong>Single player</strong><span id="single-player-description">Explore all current lessons at your own pace.</span><span class="mode-cta" id="single-player-cta">Start learning <span aria-hidden="true">↗</span></span></span></button>
          <button type="button" class="play-mode-choice multiplayer-choice" disabled aria-describedby="multiplayer-description"><span class="play-mode-icon">${multiplayerIcon}</span><span class="play-mode-copy"><strong>Multiplayer</strong><span id="multiplayer-description">Adventures with friends are on the way.</span><span class="mode-soon">Coming soon</span></span><span class="mode-lock" aria-hidden="true">${'<svg viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="9" rx="3"/><path d="M6.5 9V6a3.5 3.5 0 0 1 7 0v3"/></svg>'}</span></button>
          <p class="mode-selection-note" id="mode-selection-note"></p>
        </div>
      </dialog>
      <p class="sr-only" id="language-status" role="status" aria-live="polite"></p>
    </form>
  </main><footer class="auth-footer">One language. A world of possibility.</footer>`;
  const form = app.querySelector<HTMLFormElement>('#language-form')!;
  const button = app.querySelector<HTMLButtonElement>('#language-continue')!;
  const status = app.querySelector<HTMLElement>('#language-status')!;
  const dialog = app.querySelector<HTMLDialogElement>('#play-mode-dialog')!;
  let entrance: Animation | undefined;
  let stopParticles = () => {};
  let scrollLocked = false;
  let pageScroll = { x: 0, y: 0 };
  function lockPage() {
    if (scrollLocked) return;
    pageScroll = { x: window.scrollX, y: window.scrollY };
    document.body.style.setProperty('--play-mode-scroll-top', `${-pageScroll.y}px`);
    document.body.classList.add('play-mode-open');
    scrollLocked = true;
  }
  function restorePage() {
    if (!scrollLocked) return;
    scrollLocked = false;
    document.body.classList.remove('play-mode-open');
    document.body.style.removeProperty('--play-mode-scroll-top');
    window.scrollTo({ left: pageScroll.x, top: pageScroll.y, behavior: 'instant' });
  }
  function closeOptions() {
    dialog.close();
    restorePage();
    const selected = form.querySelector<HTMLInputElement>('input[name="language"]:checked');
    selected?.focus({ preventScroll: true });
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeOptions(); });
  app.querySelector<HTMLButtonElement>('#mode-close')!.onclick = closeOptions;
  dialog.addEventListener('close', () => {
    stopParticles();
    restorePage();
    entrance?.cancel();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeOptions();
  });
  function selectedLanguage() {
    return languages.find(language => language.id === new FormData(form).get('language'));
  }
  function updateSelection(open = false) {
    const selected = selectedLanguage();
    if (!selected) return;
    app.querySelector('#mode-flag')!.textContent = selected.flag;
    const native = app.querySelector<HTMLElement>('#mode-native')!;
    native.textContent = selected.native; native.lang = selected.id;
    app.querySelector('#mode-english')!.textContent = selected.english;
    button.disabled = !selected.available;
    button.setAttribute('aria-label', selected.available ? `Single player: ${hasStarted(selected.id) ? 'continue learning' : 'start learning'} ${selected.english}` : `Single player ${selected.english} lessons coming soon`);
    app.querySelector('#single-player-cta')!.innerHTML = selected.available ? `${hasStarted(selected.id) ? 'Continue learning' : 'Start learning'} <span aria-hidden="true">↗</span>` : 'Lessons coming soon';
    app.querySelector('#mode-selection-note')!.textContent = selected.available ? 'Single player opens your lesson map with all available chapters.' : `${selected.english} lessons are still being built. Choose Nepali to play now.`;
    status.textContent = `${selected.english} selected. ${selected.available ? 'Single player is available. Multiplayer is coming soon.' : 'Lessons are coming soon.'}`;
    if (open && !dialog.open) {
      lockPage();
      dialog.showModal();
      app.querySelector<HTMLButtonElement>('#mode-close')!.focus({ preventScroll: true });
      stopParticles();
      stopParticles = burstLanguageLetters(dialog, selected.id);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        entrance = dialog.animate([
          { opacity: 0, transform: 'scale(.985)' },
          { opacity: 1, transform: 'scale(1)' },
        ], { duration: 280, easing: 'cubic-bezier(.22,.61,.36,1)' });
      }
    }
  }
  form.onchange = () => updateSelection(true);
  form.addEventListener('click', event => {
    if (event.target instanceof HTMLInputElement && event.target.name === 'language') updateSelection(true);
  });
  if (lastLanguage) updateSelection();
  function openLanguage(language: typeof languages[number]) {
    if (!language.available) return;
    button.disabled = true;
    const resume = app.querySelector<HTMLButtonElement>('#resume-learning');
    if (resume) resume.disabled = true;
    app.querySelector('#single-player-cta')!.textContent = 'Opening your world…';
    try { recordLanguageStarted(localStorage, language.id); } catch { /* Optional history. */ }
    window.location.assign('/map/index.html');
  }
  const resume = app.querySelector<HTMLButtonElement>('#resume-learning');
  if (resume && lastLanguage) resume.onclick = () => openLanguage(lastLanguage);
  form.onsubmit = event => {
    event.preventDefault();
    const selected = selectedLanguage();
    if (selected) openLanguage(selected);
  };
  return () => {
    stopParticles();
    entrance?.cancel();
    restorePage();
    dialog.close();
    document.documentElement.classList.remove('language-selection-screen');
  };
}
