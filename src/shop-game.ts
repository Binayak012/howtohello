import { recordLanguageStarted } from './learning-history';
import { completeLevel, completedLevels } from './progression';
import { NumberLesson } from './numbers';
import { MarketExplorer } from './market-play';
import { learnedNumbersKey } from './market-world';
import './tokens.css';
import './style.css';
import './lesson.css';
import './market.css';
import './numbers.css';
import './market-play.css';
import './shop-guide.css';
import { atCheckout, atShopDoor, baseBeats, facedRack, rackFor, relativeTo, routeTo, start, step, turn, type Item } from './core';
import { EffectsController } from './effects';

import { pack } from './pack';
import { RadioController, type RadioState } from './radio';
import { ShopScene } from './scene';
import { createStock, takeOne } from './stock';

type Phase = 'story' | 'learn' | 'practice' | 'shop' | 'checkout' | 'scanning' | 'collect' | 'exit' | 'departing' | 'complete' | 'market';
type Move = keyof typeof pack.directions;
const practice: Move[] = ['right', 'left', 'forward', 'backward'];
const app = document.querySelector<HTMLDivElement>('#app')!;
try { recordLanguageStarted(localStorage, 'ne'); } catch { /* Optional browser-local learning history. */ }
app.innerHTML = `
  <header class="masthead"><a class="brand" href="${import.meta.env.BASE_URL === '/game/' ? '/' : './'}" aria-label="Wayword home"><span class="brand-mark">w</span>wayword<span class="brand-dot">.</span></a><span class="chapter">THE LITTLE SHOP · CHAPTER 05</span><div class="header-actions"><button id="radio-toggle" class="quiet radio-toggle" aria-label="Turn radio off" aria-pressed="true">Radio: On</button><button id="nepali-script" class="quiet reading-toggle" aria-label="Hide Nepali script" aria-pressed="true" title="Show or hide Nepali script">ने</button><button id="reading-help" class="quiet reading-toggle" aria-label="Show Latin-letter guides" aria-pressed="true" title="Show Latin-letter guides">Aa</button><button id="fullscreen" class="quiet" aria-label="Enter full screen">⛶</button><button id="restart" class="quiet">Start over ↺</button></div></header>

  <main><section class="game" aria-label="Shop language lesson"><div id="scene"></div><div class="vignette"></div>
    <div class="scene-top"><div class="mission"><div id="mission-label" class="eyebrow">YOUR FIRST ERRAND</div><strong id="objective"></strong><div id="order" class="order"></div><div id="basket" class="basket" aria-live="polite"></div></div><div id="pips" class="pips"></div><button id="help" class="hint-button" aria-label="Get a hint"><span aria-hidden="true">?</span>Hint</button></div>
    <div class="cue" aria-label="Direction cue"><span id="cue-item" class="cue-item"></span><div class="cue-body"><span class="cue-arrow" aria-hidden="true"><i id="cue-arrow">↑</i></span><div class="cue-word"><div id="target" class="target" lang="ne"></div><span id="pronunciation" class="latin-guide" lang="ne-Latn"></span></div></div><p id="caption" hidden></p></div>
    <div class="scene-bottom"><div class="compass"><strong id="facing">N</strong><span>↑</span></div><div id="position" class="position"></div></div><div id="shelf-stock" class="shelf-stock" hidden></div>
    <div id="checkout-status" class="checkout-status" role="status" aria-live="polite" hidden></div>
    <section id="welcome" class="welcome" role="dialog" aria-modal="false" aria-labelledby="welcome-title"><div id="intro-card" class="welcome-card"></div></section>
    <div id="market-journey" class="market-journey" hidden><div class="market-letterbox top"></div><div class="market-letterbox bottom"></div><div class="market-caption" role="status"><span id="journey-eyebrow">LEAVING THE SHOP</span><h2 id="journey-title">“धन्यवाद! See you soon.”</h2><p id="journey-line">The shopkeeper waves as the door swings open.</p></div><button id="skip-journey" type="button">Continue <span aria-hidden="true">↗</span></button></div>
    <div id="results" class="results" hidden></div>
    <section id="market-arrival" class="market-arrival" aria-labelledby="market-title" hidden><p class="eyebrow">CHAPTER 06 · FINALE · THE MORNING MARKET</p><h2 id="market-title">Good morning, neighbor!</h2><ol class="finale-topics finale-pictures" aria-label="Today’s errands"><li><span aria-hidden="true">👋</span><strong lang="ne">नमस्ते</strong><span class="sr-only">Greet everyone</span></li><li><span aria-hidden="true">🍎</span><strong lang="ne">दुई रातो</strong><span class="sr-only">Maya, fruit stall</span></li><li><span aria-hidden="true">🥖</span><strong lang="ne">तीन</strong><span class="sr-only">Arun, bakery</span></li><li><span aria-hidden="true">💐</span><strong lang="ne">चार पहेँलो</strong><span class="sr-only">Tara, flower stall</span></li></ol><p class="finale-how"><kbd>W A S D</kbd> walk · <kbd>E</kbd> talk · 💡 meanings</p><button id="market-learn" class="primary">Start exploring ↗</button><button id="market-replay" class="quiet">Replay the shop</button>${import.meta.env.BASE_URL === '/game/' ? '<a class="quiet" href="/map/index.html">Back to your map ↗</a>' : ''}</section>
    <section id="numbers-lesson" class="numbers-lesson" role="dialog" aria-modal="false" aria-labelledby="numbers-title" hidden></section>
    <section id="market-roam" class="market-exploration" aria-label="Explore the market" hidden></section>
  </section>
  <div class="playbar"><div class="feedback"><span>✦</span><div><strong id="feedback" role="status" aria-live="polite"></strong><small id="hint"></small></div></div><div class="controls"><button data-action="left" class="turn-control" aria-label="Turn left"><span class="ctl-arrow">↶</span><b lang="ne">बायाँ</b><small>LEFT</small></button><div class="step-controls"><button data-action="forward" aria-label="Step forward"><span class="ctl-arrow">↑</span><b lang="ne">अगाडि</b></button><button data-action="backward" aria-label="Step backward"><span class="ctl-arrow">↓</span><b lang="ne">पछाडि</b></button></div><button data-action="right" class="turn-control" aria-label="Turn right"><span class="ctl-arrow">↷</span><b lang="ne">दायाँ</b><small>RIGHT</small></button><button id="interact" data-action="take" class="primary">Take 1<small>SPACE</small></button></div></div>
  <footer><span>⌨ &nbsp; ← → turn · ↑ ↓ move · Space interact</span><span>Four new words. One little adventure.</span></footer></main>`;

const el = (id: string) => document.getElementById(id)!;
let phase: Phase = 'story', player = start(), practiceIndex = 0, index = 0, misses = 0, helped = false, busy = false;
let stock = createStock();
let outcomes: { text: string; en: string; misses: number; helped: boolean }[] = [];
let advanceTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let stuckTimer: ReturnType<typeof setTimeout> | undefined;
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
let journeyTimers: ReturnType<typeof setTimeout>[] = [];
let run = 0;
let readingHelp = true;
let nepaliScript = true;
/** 0 = no help yet; 1 = what the word means; 2 = which button to press; 3 = gold outline on the shelf. */
let hintLevel = 0;
let quiz: Move[] = [], quizIndex = 0, quizMisses = 0;
const tried = new Set<Move>();
export let scene: ShopScene | undefined;
let numberLesson: NumberLesson | undefined;
let explorer: MarketExplorer | undefined;
let numberLearned = false;

try { scene = new ShopScene(el('scene'), (id, unitId) => act('take', id, unitId)); }
catch { el('scene').innerHTML = '<div class="scene-fallback">Your shop map<div id="map"></div><p>Use the controls to explore. Bright tiles are shelves.</p></div>'; }
export const radio = new RadioController(scene?.camera, scene?.radioAnchor);
export const effects = new EffectsController(radio.listener, scene?.keeper);
const radioButton = el('radio-toggle') as HTMLButtonElement;
radio.subscribe((state: RadioState) => {
  const on = radio.enabled && state !== 'unavailable';
  const labels: Record<RadioState, string> = { loading: 'Radio: Loading…', on: 'Radio: On', off: 'Radio: Off', unavailable: 'Radio: Unavailable' };
  radioButton.textContent = labels[state];
  radioButton.setAttribute('aria-pressed', String(on));
  radioButton.setAttribute('aria-label', state === 'unavailable' ? 'Radio unavailable' : on ? 'Turn radio off' : 'Turn radio on');
  radioButton.dataset.state = state;
});

const angleFor: Record<Move, number> = { forward: 0, right: 90, backward: 180, left: -90 };
const plural: Item[] = ['veg', 'snack', 'book'];
const theItem = (item: Item) => `the ${pack.items[item].toLowerCase()}`;
const isAre = (item: Item) => plural.includes(item) ? 'are' : 'is';
const wordsFor = (ways: Move[]) => ({ text: ways.map(way => pack.directions[way].text).join(' · '), roman: ways.map(way => pack.directions[way].roman).join(' · '), where: ways.map(way => pack.where[way]).join(', ') });
const capital = (text: string) => text[0].toUpperCase() + text.slice(1);

function say(message: string, hint = '') { el('feedback').textContent = message; el('hint').textContent = hint; }
function focusScene() { el('scene').tabIndex = -1; el('scene').focus(); }
function pulseCue() {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelector('.cue')?.animate([{ scale: '1.08' }, { scale: '1' }], { duration: 450 });
}
function resetIdle() { clearTimeout(idleTimer); if (!['story', 'learn', 'scanning', 'complete', 'departing', 'market'].includes(phase)) idleTimer = setTimeout(pulseCue, 20000); }
/** Start the "are you stuck?" clock again after real progress. */
function armStuck(resetLevel = true) {
  clearTimeout(stuckTimer);
  if (resetLevel) hintLevel = 0;
  if (!['practice', 'shop', 'checkout', 'collect', 'exit'].includes(phase)) return;
  stuckTimer = setTimeout(() => { if (!busy) giveHint(true); armStuck(false); }, hintLevel === 0 ? 15000 : 12000);
}

/** The direction card: where the thing you need is, from where you stand right now. */
type Guide = { ways: Move[]; angle: number; label: string; english: string; ready?: boolean };
function guide(): Guide | undefined {
  if (phase === 'practice') {
    const way = practice[practiceIndex];
    return { ways: [way], angle: angleFor[way], label: 'Do what the word says', english: pack.directions[way].en };
  }
  let col: number, row: number, label: string, subject: string, verb = 'is';
  if (phase === 'shop') {
    const rack = rackFor(baseBeats[index]);
    label = pack.items[rack.item]; subject = theItem(rack.item); verb = isAre(rack.item);
    if (facedRack(player)?.id === rack.id) return { ways: ['forward'], angle: 0, label: `${label} · in front of you`, english: `${capital(subject)} ${verb} ahead. Take one!`, ready: true };
    ({ col, row } = rack);
  } else if (phase === 'checkout' || phase === 'collect') { col = 4; row = 2; label = 'The counter'; subject = 'the counter'; }
  else if (phase === 'exit') { col = 4; row = 8; label = 'The door'; subject = 'the door'; }
  else return undefined;
  const { angle, ways } = relativeTo(player, col, row);
  return { ways, angle: angle * 180 / Math.PI, label, english: `${capital(subject)} ${verb} ${wordsFor(ways).where}` };
}
/** The single next move toward the goal, used by the stronger hints. */
function nextMove(): string | undefined {
  if (phase === 'practice') return practice[practiceIndex];
  const goal = phase === 'shop' ? baseBeats[index].expect : phase === 'checkout' || phase === 'collect' ? 'at:4,3,N' : phase === 'exit' ? 'door' : undefined;
  if (!goal) return;
  if (goal === 'at:4,3,N' && atCheckout(player)) return 'take';
  const route = routeTo(player, goal), first = route?.[0];
  if (!route || (first !== 'left' && first !== 'right')) return first;
  // When both turns are equally short, turn toward the side the word names.
  const info = guide(), preferred = info && info.angle > 0 ? 'right' : 'left';
  if (first === preferred) return first;
  const other = routeTo(turn(player, preferred === 'left' ? -1 : 1), goal);
  return other && other.length + 1 <= route.length ? preferred : first;
}
/** Keep a "next move" hint true after the player moves. */
function refreshHint() {
  if (hintLevel < 2 || phase === 'practice') return;
  const next = nextMove();
  if (next === 'take') say('You’re there!', phase === 'shop' ? 'Press Space or tap Take 1.' : 'Tap the glowing button or press Space.');
  else if (next) say('Keep going.', `Next move: ${moveText[next]}.`);
}
const moveText: Record<string, string> = {
  left: `turn बायाँ (left) · press ←`, right: `turn दायाँ (right) · press →`,
  forward: `step अगाडि (forward) · press ↑`, backward: `step पछाडि (backward) · press ↓`,
};
function giveHint(auto: boolean) {
  if (busy || !['practice', 'shop', 'checkout', 'collect', 'exit'].includes(phase)) return;
  if (!auto) helped = true;
  hintLevel = Math.min(3, hintLevel + 1);
  const info = guide(), next = nextMove();
  const opener = auto ? 'Need a hand?' : 'A little nudge.';
  if (phase === 'practice') {
    const word = pack.directions[practice[practiceIndex]];
    say(opener, hintLevel === 1 ? `${word.text} (${word.roman}) means “${word.en.toLowerCase()}”. ${word.lesson}` : `Tap the glowing ${word.text} button, or press ${word.key}.`);
  } else if (next === 'take') {
    say(opener, phase === 'shop' ? `${info?.english ?? ''} Press Space or tap Take 1.` : 'You’re at the counter. Tap the glowing button or press Space.');
  } else if (hintLevel === 1 && info) {
    say(opener, `${info.english}: ${wordsFor(info.ways).text}. Look for the gold marker.`);
  } else {
    say(opener, `Next move: ${next ? moveText[next] : 'follow the arrow card'}.${hintLevel >= 3 && phase === 'shop' ? ' The shelf you need has a gold outline.' : ''}`);
  }
  render(); pulseCue();
}

function directionCards() {
  return practice.map(key => { const word = pack.directions[key]; return `<button class="direction-card direction-${key}" data-word="${key}" aria-pressed="false"><span class="word-meaning">${word.en.split(' / ')[0]}</span><span class="word-symbol" aria-hidden="true">${word.symbol}</span><strong lang="ne">${word.text}</strong><small class="latin-guide" lang="ne-Latn">${word.roman}</small><span class="card-selected" aria-hidden="true">✓</span></button>`; }).join('');
}
function showStory() {
  el('welcome').hidden = false;
  el('intro-card').classList.remove('word-lesson');
  el('intro-card').innerHTML = `<div class="eyebrow">CHAPTER 05 · THE LITTLE SHOP</div><div class="story-illustration" aria-hidden="true"><span>⌂</span><i>✦</i></div><h1 id="welcome-title" tabindex="-1">Your first<br>little errand.</h1><p>The corner shop has just opened, and you have a short shopping list.<br>Every shelf sells something different, so you’ll need to know which way to go.</p><blockquote>“Namaste! Find what you need, bring it to the counter, and I’ll pack it for you.”<small>THE SHOPKEEPER</small></blockquote><button id="shop-greeting" class="shop-greeting" aria-label="Say namaste to the shopkeeper" aria-pressed="false"><strong lang="ne">नमस्ते</strong><span><span class="latin-guide">namaste · </span>Hello<br>Greet the shopkeeper</span></button><div class="shopping-list">${baseBeats.map(beat => `<span>${pack.items[beat.item]}</span>`).join('')}</div><p class="instructions">Four Nepali words will tell you where things are.<br>Learn them, check them, then go shopping.</p><button id="begin" class="primary" disabled>Learn the four words ↗</button><small class="welcome-keys">Say hello → learn → quick check → shop → the market</small>`;
  el('shop-greeting').onclick = () => {
    scene?.greetShopkeeper();
    el('shop-greeting').setAttribute('aria-pressed','true');
    (el('begin') as HTMLButtonElement).disabled=false;
    say('“Namaste! It’s lovely to meet you.”','You’ve said hello in Nepali. You can greet your market neighbors the same way.');
    el('begin').focus();
  };
  el('begin').onclick = showWords;
  el('shop-greeting').focus();
}
function readingSwitches() {
  return `<div class="reading-preference"><span class="reading-option"><span>ने &nbsp; Nepali script</span><button id="lesson-nepali-toggle" role="switch" aria-label="Nepali script" aria-checked="${nepaliScript}">${nepaliScript ? 'On' : 'Off'}</button></span><span class="reading-option"><span>Aa &nbsp; Latin-letter guides</span><button id="lesson-reading-toggle" role="switch" aria-label="Latin-letter guides" aria-checked="${readingHelp}">${readingHelp ? 'On' : 'Off'}</button></span></div>`;
}
function bindReadingSwitches() {
  el('lesson-nepali-toggle').onclick = () => setNepaliScript(!nepaliScript);
  el('lesson-reading-toggle').onclick = () => setReadingHelp(!readingHelp);
}
/** Step 1 of the lesson: try every word and watch "you" do it. */
function showWords() {
  phase = 'learn'; render(); tried.clear();
  el('intro-card').classList.add('word-lesson'); el('intro-card').dataset.step = 'explore';
  el('intro-card').innerHTML = `<div class="lesson-steps" aria-label="Lesson steps"><span class="is-current">1 · Try each word</span><span>2 · Quick check</span><span>3 · In the shop</span></div><h1 id="welcome-title" tabindex="-1">Find your bearings.</h1><p class="script-intro">Tap each word to see the yellow “you” do it.<br>Say it out loud as you go.</p><div class="direction-map">${directionCards()}<div class="you-marker" aria-label="You, facing forward"><span>↑</span><small>YOU</small></div></div><div class="word-detail"><span class="detail-spark" aria-hidden="true">✦</span><p id="word-explanation" class="word-explanation" role="status">Start with any word.</p></div><button id="lesson-next" class="primary lesson-cta" disabled><span id="lesson-next-label">Try all four words · 0 / 4</span><span aria-hidden="true">↗</span></button>${readingSwitches()}`;
  bindReadingSwitches();
  const select = (key: Move) => {
    const word = pack.directions[key];
    el('word-explanation').innerHTML = `<strong lang="ne">${word.text}</strong> <span class="latin-guide">${word.roman}</span> = <b>${word.en.toLowerCase()}</b>. ${word.lesson}`;
    document.querySelectorAll<HTMLElement>('[data-word]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.word === key)));
    document.querySelector(`[data-word="${key}"]`)?.classList.add('is-tried');
    el('intro-card').dataset.direction = key; tried.add(key);
    const done = tried.size === 4;
    (el('lesson-next') as HTMLButtonElement).disabled = !done;
    el('lesson-next-label').textContent = done ? 'Quick check: do you remember?' : `Try all four words · ${tried.size} / 4`;
  };
  document.querySelectorAll<HTMLButtonElement>('[data-word]').forEach(button => button.onclick = () => select(button.dataset.word as Move));
  el('lesson-next').onclick = showQuiz;
  document.querySelector<HTMLButtonElement>('[data-word="right"]')!.focus();
}
/** Step 2: the word is shown, the learner shows the way. No English on the buttons. */
function showQuiz() {
  quiz = [...practice].sort(() => Math.random() - .5); quizIndex = 0; quizMisses = 0;
  el('intro-card').dataset.step = 'quiz'; delete el('intro-card').dataset.direction;
  el('intro-card').innerHTML = `<div class="lesson-steps" aria-label="Lesson steps"><span class="is-done">1 · Try each word ✓</span><span class="is-current">2 · Quick check</span><span>3 · In the shop</span></div><h1 id="welcome-title" tabindex="-1">Which way?</h1><p class="script-intro">Read the word, then tap the arrow it means, or press that arrow key.</p><div class="quiz-word"><strong id="quiz-word" lang="ne"></strong><span id="quiz-roman" class="latin-guide"></span></div><div class="direction-map quiz-map">${practice.map(key => `<button class="direction-card direction-${key} quiz-card" data-answer="${key}" aria-label="${pack.directions[key].en.split(' / ')[0]}"><span class="quiz-arrow" aria-hidden="true">${pack.directions[key].symbol}</span></button>`).join('')}<div class="you-marker" aria-hidden="true"><span>↑</span><small>YOU</small></div></div><div class="quiz-score" aria-hidden="true">${quiz.map(() => '<i></i>').join('')}</div><p id="quiz-feedback" class="quiz-feedback" role="status" aria-live="polite"></p><button id="begin" class="primary lesson-cta" hidden><span>Let’s try it in the shop</span><span aria-hidden="true">↗</span></button>${readingSwitches()}`;
  bindReadingSwitches();
  document.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(button => button.onclick = () => answerQuiz(button.dataset.answer as Move));
  el('begin').onclick = () => {
    phase = 'practice'; el('welcome').hidden = true; render(); focusScene(); resetIdle(); armStuck();
    say('Now with your feet.', 'Do what the Nepali word says. Use the buttons or the arrow keys.');
  };
  askQuiz();
  el('welcome-title').focus();
}
function askQuiz() {
  const word = pack.directions[quiz[quizIndex]];
  el('quiz-word').textContent = word.text; el('quiz-word').dataset.expect = quiz[quizIndex];
  el('quiz-roman').textContent = word.roman;
  document.querySelectorAll('.quiz-score i').forEach((dot, i) => dot.className = i < quizIndex ? 'done' : i === quizIndex ? 'current' : '');
}
function answerQuiz(key: Move) {
  if (el('intro-card').dataset.step !== 'quiz' || quizIndex >= quiz.length || busy) return;
  const wanted = quiz[quizIndex], word = pack.directions[wanted], chosen = pack.directions[key];
  const button = document.querySelector<HTMLElement>(`[data-answer="${key}"]`);
  if (key !== wanted) {
    quizMisses++;
    el('quiz-feedback').innerHTML = `That way is <strong lang="ne">${chosen.text}</strong> (${chosen.en.split(' / ')[0].toLowerCase()}). Look again: <strong lang="ne">${word.text}</strong>?`;
    el('quiz-feedback').dataset.state = 'miss';
    button?.animate([{ translate: '-5px 0' }, { translate: '5px 0' }, { translate: '0 0' }], { duration: 260 });
    // Missed words come back once more at the end.
    if (!quiz.slice(quizIndex + 1).includes(wanted)) { quiz.push(wanted); document.querySelector('.quiz-score')!.insertAdjacentHTML('beforeend', '<i></i>'); }
    return;
  }
  el('intro-card').dataset.direction = key;
  el('quiz-feedback').innerHTML = `✓ <strong lang="ne">${word.text}</strong> means ${word.en.split(' / ')[0].toLowerCase()}.`;
  el('quiz-feedback').dataset.state = 'right';
  button?.classList.add('is-right'); busy = true;
  setTimeout(() => {
    busy = false; button?.classList.remove('is-right'); quizIndex++;
    if (quizIndex < quiz.length) { delete el('intro-card').dataset.direction; askQuiz(); return; }
    document.querySelectorAll('.quiz-score i').forEach(dot => dot.className = 'done');
    el('intro-card').dataset.step = 'passed';
    el('quiz-feedback').innerHTML = quizMisses ? `All four found. The ones you missed came back for a second try.` : 'All four, first try. You know your way around!';
    el('begin').hidden = false; el('begin').focus();
  }, scene?.reducedMotion ? 150 : 650);
}

function render() {
  app.dataset.phase = phase;
  document.querySelector<HTMLElement>('.chapter')!.textContent = phase === 'market' ? 'THE MORNING MARKET · CHAPTER 06 · FINALE' : 'THE LITTLE SHOP · CHAPTER 05';
  document.querySelector<HTMLElement>('.game')!.setAttribute('aria-label', phase === 'market' ? 'Morning market' : 'Shop language lesson');
  const inStore = ['practice','shop','checkout','scanning','collect','exit'].includes(phase);
  radio.setInside(inStore);
  effects.setActive(inStore);

  scene?.setPlayer(player);
  const targetRack = phase === 'shop' ? rackFor(baseBeats[index]) : undefined;
  scene?.setHighlight(targetRack ? misses >= 3 || hintLevel >= 3 ? targetRack.id : facedRack(player)?.id : undefined);
  if (phase !== 'market') scene?.setBeacon(targetRack ? { x: targetRack.col - 4, y: 2.02, z: targetRack.row - 4 } : undefined);
  el('facing').textContent = player.facing;
  el('position').textContent = `Tile ${player.col}, ${player.row} · Facing ${player.facing}`;
  const teaching = phase === 'practice';
  const info = guide();
  const cue = document.querySelector<HTMLElement>('.cue')!;
  if (info) {
    const words = wordsFor(info.ways);
    el('target').textContent = words.text;
    el('pronunciation').textContent = words.roman;
    el('cue-item').textContent = info.label;
    el('caption').textContent = info.english;
    el('cue-arrow').style.setProperty('--turn', `${info.angle}deg`);
    cue.dataset.side = info.ways.includes('left') ? 'left' : info.ways.includes('right') ? 'right' : info.ways[0] === 'backward' ? 'behind' : 'ahead';
    cue.dataset.ready = String(!!info.ready);
    // In practice the arrow would give the answer away, so it waits for a miss or a hint.
    cue.dataset.arrow = String(!teaching || misses > 0 || hintLevel > 0);
  }
  app.dataset.readingHelp = String(readingHelp);
  app.dataset.nepaliScript = String(nepaliScript);
  el('caption').hidden = misses < 1 && hintLevel < 1;
  cue.hidden = !info || (['checkout', 'collect'].includes(phase) && atCheckout(player));
  el('mission-label').textContent = teaching ? `GUIDED PRACTICE · ${practiceIndex + 1} / 4` : 'YOUR FIRST ERRAND';
  const beatItem = baseBeats[index]?.item;
  const objectives: Record<Phase, string> = {
    story: 'A short list. A little adventure.', learn: 'Four words to find your way.',
    practice: 'Do what the Nepali word says',
    shop: `Find and take: ${beatItem ? pack.items[beatItem].toLowerCase() : ''}`,
    checkout: atCheckout(player) ? 'Put your four items on the counter' : 'Bring your items to the counter',
    scanning: 'The shopkeeper is scanning your items', collect: atCheckout(player) ? 'Your shopping is packed. Pick it up!' : 'Pick up your packed bag at the counter',
    exit: 'Take your packed shopping to the door', departing: 'A new day in the neighborhood', complete: 'Your first errand is complete!', market: 'Welcome to the morning market',
  };
  el('objective').textContent = objectives[phase];
  const picked = stock.filter(unit => unit.taken);
  el('order').innerHTML = baseBeats.map((beat, i) => `<span class="order-item ${i < picked.length ? 'collected' : i === index && phase === 'shop' ? 'current' : ''}">${i < picked.length ? '✓ ' : ''}${pack.items[beat.item]}</span>`).join('');
  renderStock();
  const total = teaching ? 4 : 6;
  const active = teaching ? practiceIndex : phase === 'shop' ? index : ['checkout', 'scanning', 'collect'].includes(phase) ? 4 : phase === 'exit' ? 5 : ['complete', 'departing', 'market'].includes(phase) ? 6 : 0;
  el('pips').setAttribute('aria-label', teaching ? `Practice ${practiceIndex + 1} of 4` : `Step ${Math.min(active + 1, 6)} of 6`);
  el('pips').innerHTML = Array.from({ length: total }, (_, i) => `<span class="pip ${i < active ? 'done' : i === active ? 'active' : ''}">${i < active ? '✓' : ''}</span>`).join('');
  const inactive = busy || ['story', 'learn', 'scanning', 'departing', 'complete', 'market'].includes(phase);
  document.querySelectorAll<HTMLButtonElement>('[data-action], #help').forEach(button => button.disabled = inactive);
  const labels: Partial<Record<Phase, string>> = { checkout: 'Place items', scanning: 'Scanning…', collect: 'Pick up bag', exit: 'Bag packed ✓', complete: 'Done ✓' };
  const label = labels[phase] ?? 'Take 1';
  el('interact').innerHTML = `${label}<small>SPACE</small>`;
  el('interact').setAttribute('aria-label', phase === 'shop' ? 'Take one item' : label);
  (el('interact') as HTMLButtonElement).disabled = inactive || phase === 'practice' || phase === 'exit';
  // Stronger hints light up the one control that moves you closer.
  const suggested = hintLevel >= 2 || misses >= 2 ? nextMove() : undefined;
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
    button.classList.toggle('is-suggested', !inactive && button.dataset.action === suggested);
  });
  el('interact').classList.toggle('is-ready', !inactive && (!!info?.ready || (['checkout', 'collect'].includes(phase) && atCheckout(player))));
  const map = document.getElementById('map');
  if (map) map.innerHTML = Array.from({ length: 81 }, (_, n) => { const col = n % 9, row = Math.floor(n / 9); const rack = racksAt(col, row); return `<span class="map-tile ${rack ? 'rack' : ''}" title="${rack ? pack.items[rack] : ''}">${player.col === col && player.row === row ? ({ N:'↑', E:'→', S:'↓', W:'←' }[player.facing]) : rack ? pack.items[rack][0] : col === 4 && row === 8 ? '⇩' : col === 0 || col === 8 || row === 0 || row === 8 ? '▪' : ''}</span>`; }).join('');
}
function racksAt(col: number, row: number): Item | undefined {
  return stock.find(unit => unit.rackId === `rack_${col}_${row}`)?.item;
}
function renderStock() {
  const picked = stock.filter(unit => unit.taken);
  const contents = (Object.keys(pack.items) as Item[]).map(item => {
    const count = picked.filter(unit => unit.item === item).length;
    return count ? `${pack.items[item]} × ${count}` : '';
  }).filter(Boolean).join(' · ');
  el('basket').textContent = phase === 'exit' || phase === 'complete' ? '✓ Carrying your packed shopping' : phase === 'collect' ? '✓ All four items scanned & packed' : phase === 'scanning' ? 'Your items are on the counter' : picked.length ? `In your basket: ${contents}` : 'Your basket is empty';
  el('basket').dataset.count = String(picked.length);
  const rack = facedRack(player);
  el('shelf-stock').hidden = !rack || phase !== 'shop';
  if (rack) {
    const remaining = stock.filter(unit => unit.rackId === rack.id && !unit.taken).length;
    el('shelf-stock').textContent = `${pack.items[rack.item]} · ${remaining} on shelf${rack.id === rackFor(baseBeats[index] ?? baseBeats[0]).id ? ' · Take one' : ''}`;
    el('shelf-stock').dataset.remaining = String(remaining);
  }
}
function miss(text?: string) {
  misses++;
  const info = guide();
  if (phase === 'practice') {
    const word = pack.directions[practice[practiceIndex]];
    say('Almost. Try again.', `${word.text} means “${word.en.toLowerCase()}”. ${word.lesson}`);
  } else say('Not that one.', text ?? (info ? `${info.english}: ${wordsFor(info.ways).text}.` : 'Follow the arrow card.'));
  if (misses >= 3) hintLevel = Math.max(hintLevel, 3);
  pulseCue(); render();
}
function move(action: string) {
  if (action === 'left' || action === 'right') player = turn(player, action === 'left' ? -1 : 1);
  if (action === 'forward' || action === 'backward') {
    const next = step(player, action === 'backward');
    if (next === player) {
      say(player.col === 4 && player.row === 7 ? 'Visit the counter before you leave.' : 'There’s something in the way.', 'Turn toward the open aisle.'); return false;
    }
    player = next;
  }
  return true;
}
function act(action: string, rackId?: string, unitId?: string) {
  if (busy || ['story', 'learn', 'scanning', 'complete', 'market'].includes(phase)) return;
  resetIdle();
  if (phase === 'practice') {
    const key = practice[practiceIndex], word = pack.directions[key];
    if (action !== word.action) { miss(); return; }
    move(action);
    if (action === 'forward' || action === 'backward') effects.footstep();
    outcomes.push({ text: word.text, en: word.en, misses, helped });
    busy = true; render(); say(`✓ ${word.text} · ${word.en.split(' / ')[0].toLowerCase()}`, key === 'backward' ? 'You stepped back without turning. All four words tried!' : 'That’s it. On to the next word.');
    advanceTimer = setTimeout(() => {
      busy = false; misses = 0; helped = false;
      if (practiceIndex === 3) { phase = 'shop'; say('Now for your first errand.', `${capital(theItem(baseBeats[0].item))} ${isAre(baseBeats[0].item)} ${wordsFor(relativeTo(player, rackFor(baseBeats[0]).col, rackFor(baseBeats[0]).row).ways).where}. The arrow card always points to the next thing on your list.`); }
      else { practiceIndex++; say('Your next word.', 'Do what it says.'); }
      armStuck(); render(); pulseCue();
    }, 650);
    return;
  }
  if (action !== 'take') {
    if (!move(action)) return;
    if (action === 'forward' || action === 'backward') effects.footstep();
    refreshHint(); render();
    if (phase === 'exit' && atShopDoor(player)) {
      // Let the final forward step reach the door before presenting the recap.
      busy = true; render();
      advanceTimer = setTimeout(finish, scene?.reducedMotion ? 0 : 260);
    }
    return;
  }
  if (phase === 'checkout' || phase === 'collect') {
    if (!atCheckout(player)) { say('Meet the shopkeeper at the counter.', 'Stand in the middle aisle facing the counter. Follow the arrow card, or tap Hint.'); return; }
    if (phase === 'checkout') startCheckout();
    else {
      scene?.collectPackedBag(); effects.bagRustle(); phase = 'exit'; render(); pulseCue(); armStuck();
      say('“All packed. Have a lovely day!”', 'Walk to the door. The arrow card shows the way.');
    }
    return;
  }
  if (phase !== 'shop') return;
  const rack = facedRack(player), beat = baseBeats[index], want = rackFor(beat);
  if (rackId && rack?.id !== rackId) {
    // Clicking a shelf you aren't facing: say where you are aiming instead.
    const clicked = stock.find(unit => unit.rackId === rackId)?.item;
    if (clicked && rackId !== want.id) { miss(`That’s the ${pack.items[clicked].toLowerCase()} shelf. ${capital(theItem(beat.item))} ${isAre(beat.item)} ${wordsFor(guide()!.ways).where}: ${wordsFor(guide()!.ways).text}.`); return; }
    if (clicked) { say('Nearly there!', `Face the ${pack.items[clicked].toLowerCase()} shelf first. Follow the arrow card.`); return; }
  }
  if (!rack) { miss(`Face a shelf first. ${capital(theItem(beat.item))} ${isAre(beat.item)} ${wordsFor(guide()!.ways).where}.`); return; }
  if (rack.id !== want.id) { miss(`That’s the ${pack.items[rack.item].toLowerCase()} shelf. You need ${theItem(beat.item)}: ${wordsFor(guide()!.ways).text} (${wordsFor(guide()!.ways).where}).`); return; }
  const unit = takeOne(stock, rack.id, unitId);
  if (!unit) { say('That item is already in your basket.', 'Choose another item on this shelf.'); return; }
  scene?.takeUnit(unit.id);
  if (unit.item === 'bag' || unit.item === 'snack') effects.bagRustle();
  if (unit.item === 'fruit' || unit.item === 'veg') effects.fruitPickup();
  if (unit.item === 'bottle') effects.bottlePickup();
  const way = wordsFor(relativeTo(start(), rack.col, rack.row).ways);
  outcomes.push({ text: way.text, en: pack.items[unit.item], misses, helped });
  busy = true; render(); say(`✓ ${pack.items[unit.item]} in your basket.`, index === baseBeats.length - 1 ? 'That’s everything on your list!' : 'Nice find.');
  advanceTimer = setTimeout(() => {
    busy = false; misses = 0; helped = false;
    if (index === baseBeats.length - 1) { phase = 'checkout'; say('You found everything on your list.', 'Bring your four items to the counter. Follow the arrow card.'); }
    else { index++; const next = baseBeats[index]; say(`Next: ${pack.items[next.item].toLowerCase()}.`, `${capital(theItem(next.item))} ${isAre(next.item)} ${wordsFor(guide()!.ways).where}. Read the arrow card.`); }
    armStuck(); render(); pulseCue();
  }, 850);
}
function startCheckout() {
  phase = 'scanning'; render(); clearTimeout(idleTimer); clearTimeout(stuckTimer);
  effects.shopkeeperReaction();
  el('checkout-status').hidden = false;
  el('checkout-status').innerHTML = '<span class="eyebrow">AT THE COUNTER</span><strong>Putting your items down…</strong><div class="scan-dots">○ ○ ○ ○</div>';
  say('“Let me take care of those.”', 'The shopkeeper will scan each item and pack your shopping.');
  const generation = run;
  const onScan = (count: number) => {
    if (generation !== run) return;
    if (count < 4) effects.barcodeScan();
    if (count === 2) effects.shopkeeperReaction();
    el('checkout-status').innerHTML = `<span class="eyebrow">AT THE COUNTER</span><strong>${count === 4 ? 'Packing your shopping…' : `Scanning item ${count + 1} of 4`}</strong><div class="scan-dots">${Array.from({ length: 4 }, (_, i) => i < count ? '✓' : i === count ? '●' : '○').join(' ')}</div>`;
    el('checkout-status').dataset.scanned = String(count);
  };
  const ready = () => {
    if (generation !== run) return;
    effects.bagRustle();
    effects.shopkeeperReaction();
    phase = 'collect'; el('checkout-status').hidden = true; armStuck(); render();
    say('“Here you are. All packed!”', 'Pick up the packed bag from the counter, then head for the door.');
  };
  const ids = stock.filter(unit => unit.taken).map(unit => unit.id);
  if (scene) scene.beginCheckout(ids, onScan, ready);
  else {
    const tick = (count: number) => { onScan(count); fallbackTimer = setTimeout(() => count === 4 ? ready() : tick(count + 1), count === 4 ? 600 : 1100); };
    fallbackTimer = setTimeout(() => tick(0), 650);
  }
}
/** Captions that tell the short story of walking out of the shop and into the market. */
const journeyStages = [
  { eyebrow: 'LEAVING THE SHOP', title: '“धन्यवाद! See you soon.”', line: 'The shopkeeper waves as the door swings open.' },
  { eyebrow: 'OUTSIDE', title: 'The street is waking up.', line: 'Stalls are opening. Neighbors are saying नमस्ते.' },
  { eyebrow: 'CHAPTER 06 · FINALE', title: 'The Morning Market', line: 'Three neighbors could use your help.' },
];
function showJourneyStage(stage: number) {
  const { eyebrow, title, line } = journeyStages[stage];
  el('journey-eyebrow').textContent = eyebrow; el('journey-title').textContent = title; el('journey-line').textContent = line;
  const caption = document.querySelector<HTMLElement>('.market-caption')!;
  caption.dataset.stage = String(stage);
  caption.classList.remove('is-showing'); void caption.offsetWidth; caption.classList.add('is-showing');
}
function beginDeparture() {
  if (phase !== 'complete' || !atShopDoor(player)) return;
  el('results').hidden = true;
  phase = 'departing'; busy = true; clearTimeout(idleTimer); clearTimeout(stuckTimer); render();
  el('market-journey').hidden = false;
  el('skip-journey').focus();
  showJourneyStage(0);
  journeyTimers.forEach(clearTimeout);
  journeyTimers = [setTimeout(() => showJourneyStage(1), 3000), setTimeout(() => showJourneyStage(2), 6000)];
  say('The neighborhood is waking up.', 'Your first words have taken you somewhere new.');
  const generation = run;
  const done = () => { if (generation === run && phase === 'departing') arriveAtMarket(); };
  if (scene) scene.walkIntoMarket(done);
  else fallbackTimer = setTimeout(done, 900);
}
el('skip-journey').onclick = () => {
  if (phase !== 'departing') return;
  if (scene) scene.finishDeparture();
  else { clearTimeout(fallbackTimer); arriveAtMarket(); }
};
function arriveAtMarket() {
  if (phase !== 'departing') return;
  journeyTimers.forEach(clearTimeout); journeyTimers = [];
  el('market-journey').hidden = true;
  phase = 'market'; busy = false; render();
  el('market-arrival').hidden = false;
  el('market-title').tabIndex = -1; el('market-title').focus();
  say('Welcome to the morning market.', 'Three neighbors could use your help.');
  try { numberLearned=localStorage.getItem(learnedNumbersKey)==='true'; } catch { numberLearned=false; }
  if(numberLearned) startExploring();
}
el('market-replay').onclick = restart;
function startExploring() {
  numberLesson?.dispose();numberLesson=undefined;
  el('market-arrival').hidden=true;
  if(explorer) explorer.setPaused(false);
  else explorer=new MarketExplorer(el('market-roam'),scene,openNumberLesson);
}
function openNumberLesson() {
  if (phase !== 'market' || numberLesson) return;
  explorer?.setPaused(true);
  el('market-arrival').hidden = true;
  numberLesson = new NumberLesson(el('numbers-lesson'), () => {
    numberLearned=true;
    try { localStorage.setItem(learnedNumbersKey,'true'); } catch { /* Optional local progress. */ }
    startExploring();
  }, () => {
    numberLesson?.dispose(); numberLesson = undefined;
    startExploring();
  });
}
// Numbers are taught in chapter 3, so the finale opens straight into the street; the explorer can still open them for review.
el('market-learn').onclick=()=>{numberLearned=true;try{localStorage.setItem(learnedNumbersKey,'true');}catch{/* Optional local progress. */}startExploring();};
function finish() {
  // The shop finishes inside, with the packed bag, before the door opens.
  if (phase !== 'exit' || !atShopDoor(player)) return;
  scene?.clearPickup();
  phase = 'complete'; busy = false; clearTimeout(idleTimer); clearTimeout(stuckTimer); render();
  effects.levelComplete();
  try { completeLevel(localStorage, 'little-shop'); } catch { /* Play works without storage. */ }
  const mastered = outcomes.filter(outcome => !outcome.misses && !outcome.helped).length;
  const celebration = Array.from({ length: 16 }, (_, i) => `<i style="--angle:${i * 22.5}deg;--distance:${54 + i % 3 * 14}px;--delay:${i % 4 * 45}ms">${i % 3 ? '✦' : '●'}</i>`).join('');
  el('results').hidden = false;
  el('results').innerHTML = `<div class="completion-celebration" aria-hidden="true"><div class="completion-sparks">${celebration}</div><div class="completion-medal"><span>✓</span></div></div><div class="eyebrow">CHAPTER 05 · COMPLETE</div><h2>Your first errand. Done.</h2><p>${baseBeats.map(beat => pack.items[beat.item].toLowerCase()).join(', ').replace(/^./, letter => letter.toUpperCase())}: found with four Nepali words.</p><div class="recap-words">${practice.map(key => { const word = pack.directions[key]; return `<div><strong lang="ne">${word.text}</strong><span>${word.roman} · ${word.en}</span></div>`; }).join('')}</div><p>${mastered} first-try successes · ${outcomes.length - mastered} practiced with help</p><div class="next-chapter"><span class="eyebrow">UP NEXT · CHAPTER 06 · FINALE</span><strong>The Morning Market</strong><small>“धन्यवाद! The market is right outside. Your neighbors could use a hand.” · The shopkeeper</small></div><button id="next-level" class="primary">Step outside to the market <span aria-hidden="true">↗</span></button><button id="again" class="quiet">Play the shop again</button>${import.meta.env.BASE_URL === '/game/' ? '<a class="quiet map-return" href="/map/index.html">Back to your map ↗</a>' : ''}`;
  el('next-level').onclick = beginDeparture;
  el('again').onclick = restart; el('next-level').focus(); say('A little more at home.', 'When you’re ready, step outside. The market is waiting.');
}
function restart() {
  explorer?.dispose();explorer=undefined;numberLearned=false;
  numberLesson?.dispose(); numberLesson = undefined;
  run++; clearTimeout(advanceTimer); clearTimeout(idleTimer); clearTimeout(fallbackTimer); clearTimeout(stuckTimer);
  journeyTimers.forEach(clearTimeout); journeyTimers = [];
  effects.cancel();
  phase = 'story'; player = start(); practiceIndex = 0; index = 0; misses = 0; helped = false; busy = false; hintLevel = 0; stock = createStock(); outcomes = [];
  scene?.resetStock(); scene?.setBeacon(undefined); scene?.setPlayer(player, true);
  el('market-journey').hidden = true;
  el('market-arrival').hidden = true;
  el('results').hidden = true; el('checkout-status').hidden = true; el('checkout-status').dataset.scanned = '0';
  render(); showStory(); say('A new neighborhood. A short shopping list.', 'Your first errand begins here.');
}
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.onclick = () => { act(button.dataset.action!); if (!['story', 'learn', 'complete'].includes(phase)) focusScene(); });
el('restart').onclick = restart;
radioButton.onclick = () => radio.toggle();
function setReadingHelp(enabled: boolean) {
  readingHelp = enabled;
  app.dataset.readingHelp = String(readingHelp);
  el('reading-help').setAttribute('aria-pressed', String(readingHelp));
  const toggle = document.getElementById('lesson-reading-toggle');
  if (toggle) { toggle.setAttribute('aria-checked', String(readingHelp)); toggle.textContent = readingHelp ? 'On' : 'Off'; }
}
function setNepaliScript(enabled: boolean) {
  nepaliScript = enabled;
  app.dataset.nepaliScript = String(nepaliScript);
  el('nepali-script').setAttribute('aria-pressed', String(nepaliScript));
  el('nepali-script').setAttribute('aria-label', nepaliScript ? 'Hide Nepali script' : 'Show Nepali script');
  const toggle = document.getElementById('lesson-nepali-toggle');
  if (toggle) { toggle.setAttribute('aria-checked', String(nepaliScript)); toggle.textContent = nepaliScript ? 'On' : 'Off'; }
}
el('nepali-script').onclick = () => {
  setNepaliScript(!nepaliScript);
  if (!['story', 'learn', 'complete'].includes(phase)) focusScene();
};
el('reading-help').onclick = () => {
  setReadingHelp(!readingHelp);
  if (!['story', 'learn', 'complete', 'departing', 'market'].includes(phase)) focusScene();
};
el('help').onclick = () => { giveHint(false); focusScene(); };
el('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { say('The shop already fills this window.', 'Your browser may not support hiding its toolbar.'); }
};
document.addEventListener('fullscreenchange', () => el('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'));
window.addEventListener('keydown', event => {
  if (phase === 'market') return;
  const arrow = ({ ArrowLeft:'left', ArrowRight:'right', ArrowUp:'forward', ArrowDown:'backward' } as Record<string, Move>)[event.key];
  if (phase === 'learn') {
    if (arrow && el('intro-card').dataset.step === 'quiz') { event.preventDefault(); if (!event.repeat) answerQuiz(arrow); }
    return;
  }
  if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;
  const action: string | undefined = arrow ?? (event.key === ' ' ? 'take' : event.key === 'h' || event.key === 'H' ? 'hint' : undefined);
  if (action === 'hint') { giveHint(false); return; }
  if (action) { event.preventDefault(); if (!event.repeat) act(action); }
});
window.addEventListener('pagehide', () => { effects.dispose(); radio.dispose(); }, { once: true });

restart();
// Resume an unlocked market from the map without replaying the shop tutorial.
if (new URLSearchParams(location.search).get('level') === 'market') {
  try {
    if (completedLevels(localStorage).includes('little-shop')) {
      el('welcome').hidden = true; player = { col: 4, row: 7, facing: 'S' }; phase = 'complete';
      beginDeparture();
    }
  } catch { /* Without saved progress, begin with the shop. */ }
}
