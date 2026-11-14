import './tokens.css';
import './style.css';
import { renderLevelMap } from './level-map';
import { renderLanguages } from './languages';
import { setupAuthGuide } from './auth-guide';
import { startScrollWords } from './scroll-words';
import { setupAdventureTransition } from './adventure-transition';
const app = document.querySelector<HTMLDivElement>('#app')!;
const brand = '<a class="brand" href="/" aria-label="Wayword home"><span class="brand-icon" aria-hidden="true">w</span>wayword<span class="dot">.</span></a>';
const primary = '<a class="button primary" data-adventure href="/auth/?mode=signup">Start your adventure <span aria-hidden="true">↗</span></a>';
let disposePage = () => {};
function renderPage() {
disposePage();
const isAuth = location.pathname.startsWith('/auth');
const isLanguages = location.pathname.startsWith('/languages');
const isMap = location.pathname.startsWith('/map');
const isLanding = !isAuth && !isLanguages && !isMap;
let stopAuthGuide = () => {};
let stopMap = () => {};
if (isMap) {
stopMap = renderLevelMap(app, brand);
} else if (isLanguages) {
renderLanguages(app, brand);
} else if (isLanding) {
app.innerHTML = `
<a class="skip" href="#main">Skip to content</a>
<header class="nav wrap">${brand}<nav aria-label="Main navigation"><a class="nav-story" href="#how-it-works">How it works</a><a class="nav-story" href="#first-adventure">A peek inside</a><a href="/auth/">Log in <span aria-hidden="true">↗</span></a></nav></header>
<main id="main">
<section class="hero wrap"><div class="hero-copy"><p class="eyebrow"><span class="tiny-star">✦</span> THE LANGUAGE-LEARNING GAME YOU STEP INSIDE.</p><h1>Play a game.<br>Learn a<br><span class="world">language.</span></h1><p class="intro">Wayword is an interactive language-learning game. Explore a 3D world, complete quests, and use new words to move the story forward.</p>${primary}<p class="micro">First-person gameplay · Real language practice</p><div class="people"><span class="avatar"><img src="/assets/student.svg" alt=""></span><span class="avatar"><img src="/assets/traveler-gesture.svg" alt=""></span><span class="avatar"><img src="/assets/shopkeeper-gesture.svg" alt=""></span><p>Meet your neighbors.<br><strong>Become part of the story.</strong></p></div></div>
<div class="hero-art"><span class="spark spark-one" aria-hidden="true">✦</span><div class="scene-shell"><div class="scene-topline"><span class="live-dot"></span> QUEST PREVIEW · THE LITTLE SHOP <span>01</span></div><div class="quest-viewport"><img class="shop-scene" src="/assets/shop-scene-laptop.svg" alt="A warm neighborhood shop with wooden shelves of fruit and books, and a friendly shopkeeper."><div class="quest-overlay"><span class="quest-marker" aria-hidden="true">✦</span><div><small>YOUR MISSION</small><strong>A little errand in a new neighborhood</strong><p>Find your supplies · Bring them to the counter</p></div></div></div><div class="scene-caption"><span class="round-arrow" aria-hidden="true">↗</span><div><strong>The little shop</strong><small>Explore. Collect. Find your words.</small></div><span class="tag">QUEST 01</span></div></div><div class="floating-note"><span aria-hidden="true">✧</span> You’re the traveler.<br><strong>This is your story.</strong></div><img class="traveler" src="/assets/traveler-gesture.svg" alt="Your traveler guide waving hello"><span class="spark spark-two" aria-hidden="true">✦</span></div></section>
<div class="ribbon"><span>STEP INTO THE WORLD</span><i>✦</i><span>TAKE ON A QUEST</span><i>✦</i><span>LEARN WITH EVERY MOVE</span><i>✦</i><span>PLAY AT YOUR OWN PACE</span></div>
<section id="how-it-works" class="how wrap"><div class="section-heading"><p class="eyebrow">HOW YOU PLAY. HOW YOU LEARN.</p><h2>Your next level?<br><span>A new language.</span></h2><p>Learn the words, then use them in the game.<br>Every quest turns language practice into something you can do.</p></div><div class="steps"><article><span class="step-number">01</span><div class="step-icon lavender" aria-hidden="true">Aa</div><h3>Learn your quest’s words</h3><p>A new place. A small mission. Meet the words that will help you take it on, then step inside.</p></article><article><span class="step-number">02</span><div class="step-icon yellow" aria-hidden="true">↱</div><h3>Step into the game</h3><p>Walk through the world, meet its characters, and interact with what you find. Put each new word into action.</p></article><article><span class="step-number">03</span><div class="step-icon mint" aria-hidden="true">✓</div><h3>Complete the quest</h3><p>Find what you need, finish the errand, and see your progress. Every little win is language you’ve used.</p></article></div></section>
<section id="first-adventure" class="adventure wrap"><div class="adventure-portrait"><img src="/assets/shopkeeper-gesture.svg" alt="A smiling shopkeeper in a teal apron"><span class="hello">Come on in!</span><span class="portrait-star" aria-hidden="true">✦</span></div><div><p class="eyebrow">YOUR FIRST QUEST · THE LITTLE SHOP</p><h2>Your first playable<br>language lesson.</h2><p>The shopkeeper is waiting, and you have a list to fill. Step between the shelves, pick up your supplies, and bring them to the counter. You’re learning a language with every move.</p><p class="demo-context">Our first demo starts with Nepali. More languages are part of the journey ahead.</p><div class="lesson-facts"><span>↗ First-person exploring</span><span>⌨ Keyboard & tap</span><span>✦ Your own pace</span></div>${primary}</div></section>
<section class="closing wrap"><p class="eyebrow">THERE’S A WHOLE WORLD OUT THERE</p><h2>Ready to play<br>your way to a new language?</h2>${primary}<p class="micro">Your first quest is waiting.</p></section></main>
<footer class="footer wrap">${brand}<p>New words. New worlds. Your story.</p><a href="#main">Back to top ↑</a></footer>`;
} else {
let mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';
function renderAuth() {
stopAuthGuide();
const signup = mode === 'signup';
app.innerHTML = `<a class="skip" href="#auth-main">Skip to content</a><header class="nav wrap">${brand}<a class="back-link" href="/">← Back to the neighborhood</a></header><main id="auth-main" class="auth-layout wrap"><aside class="auth-story"><p class="eyebrow">YOUR NEXT LITTLE ADVENTURE</p><h1>A familiar face.<br>A new beginning.</h1><p>Every new word opens a little door.<br>Let’s see where this one takes you.</p><div class="auth-illustration"><span class="auth-halo"></span><div class="auth-character"><img src="/assets/traveler-gesture.svg" alt="Your friendly traveler guide holding a pen"><span class="auth-held-pen" aria-hidden="true"><svg viewBox="0 0 16 64" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h10v36L8 61 3 48Z" fill="#1f7a7a" stroke="#145454" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 48h10L8 61Z" fill="#f3d6ae"/><path d="m6 56 2 5 2-5" fill="#2b2340"/><rect x="3" y="3" width="10" height="12" rx="4" fill="#f4b63f"/><path d="M5 18v25" stroke="#fff6e8" stroke-width="2" stroke-linecap="round" opacity=".65"/><path d="M11 9h3v15" fill="none" stroke="#d49a25" stroke-width="2" stroke-linecap="round"/></svg></span></div><span class="speech">You’ve got this.</span><span class="auth-star" aria-hidden="true">✦</span></div><p class="aside-caption">A little language. A whole new world.</p></aside><section class="auth-card" aria-labelledby="auth-title"><span class="mini-mark" aria-hidden="true">✦</span><p class="eyebrow">${signup ? 'MAKE YOURSELF AT HOME' : 'GOOD TO SEE YOU AGAIN'}</p><h2 id="auth-title">${signup ? 'Your story starts here.' : 'Welcome back.'}</h2><p class="auth-subtitle">${signup ? 'Try the demo. Your first quest is waiting.' : 'Jump back into the playable demo.'}</p><div class="auth-tabs" aria-label="Account action"><button type="button" data-mode="login" aria-pressed="${!signup}">Log in</button><button type="button" data-mode="signup" aria-pressed="${signup}">Sign up</button></div><form id="auth-form"><div class="auth-name-row ${signup ? 'is-visible' : ''}" ${signup ? '' : 'inert'}><div><label for="name">Your name</label><input id="name" name="name" autocomplete="given-name" placeholder="What should we call you?" ${signup ? 'required' : 'disabled'} maxlength="80"></div></div><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required><div class="password-label"><label for="password">Password</label><button type="button" class="text-button" id="forgot" ${signup ? 'hidden' : ''}>Forgot password?</button></div><div class="password-field"><input id="password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? 'At least 8 characters' : 'Enter your password'}" minlength="8" required><button type="button" id="toggle-password" aria-label="Show password">Show</button></div><p class="field-help" id="password-help">${signup ? 'Use at least 8 characters.' : ''}</p><button class="button primary submit" type="submit">${signup ? 'Start your adventure' : 'Let’s keep going'} <span aria-hidden="true">↗</span></button><p id="form-status" role="status" aria-live="polite"></p></form><p class="preview-note"><span>PLAYABLE DEMO</span> Use any demo email and a password of at least 8 characters, then choose your language. No account is created. Your details are never saved or sent.</p><a class="explore-link" href="/#first-adventure">Explore the first adventure →</a></section></main><footer class="auth-footer">Small steps. A world of possibility.</footer>`;
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.onclick = () => {
  if (mode === button.dataset.mode) return;
  mode = button.dataset.mode!;
  const isSignup = mode === 'signup';
  history.replaceState({}, '', isSignup ? '/auth/?mode=signup' : '/auth/');
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode)));
  const card = document.querySelector<HTMLElement>('.auth-card')!;
  card.querySelector('.eyebrow')!.textContent = isSignup ? 'MAKE YOURSELF AT HOME' : 'GOOD TO SEE YOU AGAIN';
  card.querySelector('#auth-title')!.textContent = isSignup ? 'Your story starts here.' : 'Welcome back.';
  card.querySelector('.auth-subtitle')!.textContent = isSignup ? 'Try the demo. Your first quest is waiting.' : 'Jump back into the playable demo.';
  const nameRow = card.querySelector<HTMLElement>('.auth-name-row')!;
  nameRow.classList.toggle('is-visible', isSignup);
  nameRow.inert = !isSignup;
  const name = card.querySelector<HTMLInputElement>('#name')!;
  name.required = isSignup;
  name.disabled = !isSignup;
  const password = card.querySelector<HTMLInputElement>('#password')!;
  password.autocomplete = isSignup ? 'new-password' : 'current-password';
  password.placeholder = isSignup ? 'At least 8 characters' : 'Enter your password';
  card.querySelector<HTMLButtonElement>('#forgot')!.hidden = isSignup;
  card.querySelector('#password-help')!.textContent = isSignup ? 'Use at least 8 characters.' : '';
  card.querySelector('.submit')!.innerHTML = `${isSignup ? 'Start your adventure' : 'Let’s keep going'} <span aria-hidden="true">↗</span>`;
  card.querySelector('#form-status')!.textContent = '';
  card.querySelector('.preview-note')!.innerHTML = '<span>PLAYABLE DEMO</span> Use any demo email and a password of at least 8 characters, then choose your language. No account is created. Your details are never saved or sent.';
  card.dispatchEvent(new Event('auth-mode-change', { bubbles: true }));
});
const password = document.querySelector<HTMLInputElement>('#password')!;
document.querySelector<HTMLButtonElement>('#toggle-password')!.onclick = event => {const show = password.type === 'password'; password.type = show ? 'text' : 'password'; const button = event.currentTarget as HTMLButtonElement; button.textContent = show ? 'Hide' : 'Show'; button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');};
document.querySelector<HTMLFormElement>('#auth-form')!.onsubmit = event => {
  event.preventDefault();
  // Demo entry only: credentials never leave this form or enter browser storage.
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;
  const submit = form.querySelector<HTMLButtonElement>('.submit')!;
  submit.disabled = true;
  submit.textContent = 'Let’s choose your language…';
  form.reset();
  window.location.assign('/languages/index.html');
};
const forgot = document.querySelector<HTMLButtonElement>('#forgot');
if (forgot) forgot.onclick = () => { document.querySelector('#form-status')!.textContent = 'Password reset will be available when authentication is connected. No reset email has been sent.'; };
stopAuthGuide = setupAuthGuide();
}
renderAuth();
}

const stopScrollWords = isLanding ? startScrollWords() : () => {};
const stopAdventureTransition = !isLanguages && !isMap ? setupAdventureTransition(isAuth, destination => {
  history.pushState({}, '', destination);
  window.scrollTo({ top: 0, behavior: 'instant' });
  renderPage();
}) : () => {};
disposePage = () => { stopMap(); stopAuthGuide(); stopScrollWords(); stopAdventureTransition(); };
}
renderPage();
window.addEventListener('popstate', renderPage);
if (import.meta.hot) import.meta.hot.dispose(() => {
  disposePage();
  window.removeEventListener('popstate', renderPage);
});
