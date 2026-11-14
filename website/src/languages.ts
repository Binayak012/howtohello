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

export function renderLanguages(app: HTMLDivElement, brand: string) {
  let history: LearningHistory = { started: [], lastLanguage: null };
  try {
    history = readLearningHistory(localStorage);
    // Recognize completed lessons from before language history was introduced.
    if (!history.started.includes('ne') && completedLevels(localStorage).length) {
      recordLanguageStarted(localStorage, 'ne');
      history = readLearningHistory(localStorage);
    }
  } catch { /* New-learner experience works without browser storage. */ }
  const lastLanguage = languages.find(language => language.available && language.id === history.lastLanguage)
    ?? languages.find(language => language.available && history.started.includes(language.id));
  const initialLanguage = lastLanguage ?? languages.find(language => language.available)!;
  const hasStarted = (id: string) => history.started.includes(id);
  app.innerHTML = `<a class="skip" href="#languages-main">Skip to content</a>
  <header class="nav wrap">${brand}<a class="back-link" href="/">← Back to home</a></header>
  <main id="languages-main" class="language-page wrap">
    <div class="language-heading"><p class="eyebrow">NEW WORDS. NEW WORLDS.</p><h1>Where will your<br><span>adventure begin?</span></h1><p>Choose the language you’d love to explore.<br>Your first quest is just around the corner.</p></div>
    ${lastLanguage ? `<section class="language-resume" aria-label="Resume learning"><span class="resume-flag" aria-hidden="true">${lastLanguage.flag}</span><div><strong>Pick up where you left off</strong><p>${lastLanguage.english} · Your next quest is waiting</p></div><button class="button primary" id="resume-learning" type="button">Continue where you left off <span aria-hidden="true">↗</span></button></section>` : ''}
    <form id="language-form"><fieldset class="language-options"><legend class="sr-only">Choose your learning language</legend>
    ${languages.map(language => `<label class="language-option"><input type="radio" name="language" value="${language.id}" ${language.id === initialLanguage.id ? 'checked' : ''} aria-describedby="language-note-${language.id}"><span class="language-card"><span class="language-flag" aria-hidden="true">${language.flag}</span><span class="language-check" aria-hidden="true">✓</span><span class="language-native" lang="${language.id}">${language.native}</span><span class="language-english">${language.english}</span><span id="language-note-${language.id}" class="language-badge ${language.available ? 'is-playable' : ''}">${language.available ? (hasStarted(language.id) ? 'Continue learning' : 'Ready to play') : 'Coming soon'}</span></span></label>`).join('')}
    </fieldset><div class="language-action"><p id="language-status" role="status" aria-live="polite">Your Nepali adventure starts in The Little Shop.</p><button class="button primary" id="language-continue" type="submit">Let’s play in Nepali <span aria-hidden="true">↗</span></button><p class="micro">Nepali is playable in this demo. More languages are on the way.</p></div></form>
  </main><footer class="auth-footer">One language. A world of possibility.</footer>`;
  const form = app.querySelector<HTMLFormElement>('#language-form')!;
  const button = app.querySelector<HTMLButtonElement>('#language-continue')!;
  const status = app.querySelector<HTMLElement>('#language-status')!;
  function selectedLanguage() {
    const value = new FormData(form).get('language');
    return languages.find(language => language.id === value);
  }
  function updateSelection() {
    const selected = selectedLanguage();
    if (!selected) return;
    button.disabled = !selected.available;
    button.innerHTML = selected.available ? `${hasStarted(selected.id) ? 'Continue learning' : 'Let’s play'} in ${selected.english} <span aria-hidden="true">↗</span>` : `${selected.english} is coming soon`;
    status.textContent = selected.available ? (hasStarted(selected.id) ? `Welcome back. Continue your ${selected.english} journey from your map.` : `Your ${selected.english} adventure starts in The Little Shop.`) : `We’re planning ${selected.english} adventures. Choose Nepali to play the current demo.`;
  };
  form.onchange = updateSelection;
  updateSelection();
  function openLanguage(language: typeof languages[number]) {
    if (!language.available) return;
    button.disabled = true;
    const resume = app.querySelector<HTMLButtonElement>('#resume-learning');
    if (resume) resume.disabled = true;
    button.textContent = 'Opening your world…';
    try { recordLanguageStarted(localStorage, language.id); } catch { /* Optional local history. */ }
    window.location.assign('/map/index.html');
  }
  const resume = app.querySelector<HTMLButtonElement>('#resume-learning');
  if (resume && lastLanguage) resume.onclick = () => openLanguage(lastLanguage);
  form.onsubmit = event => {
    event.preventDefault();
    const selected = selectedLanguage();
    if (selected) openLanguage(selected);
  };
}
