import { recordLanguageStarted } from './learning-history';
import { completeLevel } from './progression';
import './tokens.css';
import './style.css';
import './lesson.css';
import { atCheckout, baseBeats, facedRack, outside, racks, routeTo, start, step, turn, type Item } from './core';
import { EffectsController } from './effects';
import { pack } from './pack';
import { RadioController, type RadioState } from './radio';
import { ShopScene } from './scene';
import { createStock, takeOne } from './stock';

type Phase = 'story' | 'learn' | 'practice' | 'shop' | 'checkout' | 'scanning' | 'collect' | 'exit' | 'complete';
type Move = keyof typeof pack.directions;
const practice: Move[] = ['right', 'left', 'forward', 'backward'];
const app = document.querySelector<HTMLDivElement>('#app')!;
try { recordLanguageStarted(localStorage, 'ne'); } catch { /* Optional browser-local learning history. */ }
app.innerHTML = `
  <header class="masthead"><a class="brand" href="${import.meta.env.BASE_URL === '/game/' ? '/map/index.html' : './'}" aria-label="Wayword home"><span class="brand-mark">w</span>wayword<span class="brand-dot">.</span></a><span class="chapter">THE LITTLE SHOP · YOUR FIRST ERRAND</span><div class="header-actions"><button id="radio-toggle" class="quiet radio-toggle" aria-label="Turn radio off" aria-pressed="true">Radio: On</button><button id="nepali-script" class="quiet reading-toggle" aria-label="Hide Nepali script" aria-pressed="true" title="Show or hide Nepali script">ने</button><button id="reading-help" class="quiet reading-toggle" aria-label="Show Latin-letter guides" aria-pressed="true" title="Show Latin-letter guides">Aa</button><button id="fullscreen" class="quiet" aria-label="Enter full screen">⛶</button><button id="restart" class="quiet">Start over ↺</button></div></header>
  <main><section class="game" aria-label="Shop language lesson"><div id="scene"></div><div class="vignette"></div>
    <div class="scene-top"><div class="mission"><div id="mission-label" class="eyebrow">YOUR FIRST ERRAND</div><strong id="objective"></strong><div id="order" class="order"></div><div id="basket" class="basket" aria-live="polite"></div></div><div id="pips" class="pips"></div><button id="help" class="round" aria-label="Show a navigation hint">?</button></div>
    <div class="cue" aria-label="Direction cue"><div class="cue-word"><div id="target" class="target" lang="ne"></div><span id="pronunciation" class="latin-guide" lang="ne-Latn"></span></div><p id="caption" hidden></p></div>
    <div class="scene-bottom"><div class="compass"><strong id="facing">N</strong><span>↑</span></div><div id="position" class="position"></div></div><div id="shelf-stock" class="shelf-stock" hidden></div>
    <div id="checkout-status" class="checkout-status" role="status" aria-live="polite" hidden></div>
    <section id="welcome" class="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div id="intro-card" class="welcome-card"></div></section>
    <div id="results" class="results" hidden></div>
  </section>
  <div class="playbar"><div class="feedback"><span>✦</span><div><strong id="feedback" role="status" aria-live="polite"></strong><small id="hint"></small></div></div><div class="controls"><button data-action="left" aria-label="Turn left">↶<small>LEFT</small></button><div class="step-controls"><button data-action="forward" aria-label="Step forward">↑<small>FORWARD</small></button><button data-action="backward" aria-label="Step backward">↓<small>BACKWARD</small></button></div><button data-action="right" aria-label="Turn right">↷<small>RIGHT</small></button><button id="interact" data-action="take" class="primary">Take 1<small>SPACE</small></button></div></div>
  <footer><span>⌨ &nbsp; ← → turn · ↑ ↓ move · Space interact</span><span>Four new words. One little adventure.</span></footer></main>`;

const el = (id: string) => document.getElementById(id)!;
let phase: Phase = 'story', player = start(), practiceIndex = 0, index = 0, misses = 0, helped = false, busy = false;
let stock = createStock();
let outcomes: { text: string; en: string; misses: number; helped: boolean }[] = [];
let advanceTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
let run = 0;
let readingHelp = true;
let nepaliScript = true;
export let scene: ShopScene | undefined;
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

function say(message: string, hint = '') { el('feedback').textContent = message; el('hint').textContent = hint; }
function focusScene() { el('scene').tabIndex = -1; el('scene').focus(); }
function pulseCue() {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) el('target').animate([{ opacity: .45 }, { opacity: 1 }], { duration: 500 });
}
function resetIdle() { clearTimeout(idleTimer); if (!['story', 'learn', 'scanning', 'complete'].includes(phase)) idleTimer = setTimeout(pulseCue, 20000); }
function directionCards() {
  return practice.map(key => { const word = pack.directions[key]; return `<button class="direction-card direction-${key}" data-word="${key}" aria-pressed="false"><span class="word-meaning">${word.en.split(' / ')[0]}</span><span class="word-symbol" aria-hidden="true">${word.symbol}</span><strong lang="ne">${word.text}</strong><small class="latin-guide" lang="ne-Latn">${word.roman}</small><span class="card-selected" aria-hidden="true">✓</span></button>`; }).join('');
}
function showStory() {
  el('welcome').hidden = false;
  el('intro-card').classList.remove('word-lesson');
  el('intro-card').innerHTML = `<div class="eyebrow">CHAPTER 01 · A NEW NEIGHBORHOOD</div><div class="story-illustration" aria-hidden="true"><span>⌂</span><i>✦</i></div><h1 id="welcome-title">Your first<br>little errand.</h1><p>You’ve just moved into the neighborhood.<br>A small shop is still open, and you have a short list.</p><blockquote>“Welcome! Find what you need, bring it to the counter, and I’ll pack it for you.”<small>THE SHOPKEEPER</small></blockquote><div class="shopping-list"><span>1 reusable bag</span><span>2 fruit</span><span>1 bottle</span></div><p class="instructions">Four Nepali words will help you find your way.<br>Learn them, try them, then do the shopping.</p><button id="begin" class="primary">Learn the four words ↗</button><small class="welcome-keys">Explore → collect → scan & pack → walk home</small>`;
  el('begin').onclick = showWords;
  el('begin').focus();
}
function showWords() {
  phase = 'learn'; render();
  el('intro-card').classList.add('word-lesson');
  el('intro-card').innerHTML = `<div class="eyebrow">YOUR FIRST FOUR WORDS</div><h1 id="welcome-title">Find your bearings.</h1><p class="script-intro">New to Devanagari? Start with the Latin letters.<br>Match the word to its meaning, then try the move.</p><div class="direction-map">${directionCards()}<div class="you-marker" aria-label="You, facing forward"><span>↑</span><small>YOU</small></div></div><div class="word-detail"><span class="detail-spark" aria-hidden="true">✦</span><p id="word-explanation" class="word-explanation">${pack.directions.right.lesson}</p></div><button id="begin" class="primary lesson-cta"><span>Let’s try it in the shop</span><span aria-hidden="true">↗</span></button><div class="reading-preference"><span class="reading-option"><span>ने &nbsp; Nepali script</span><button id="lesson-nepali-toggle" role="switch" aria-label="Nepali script" aria-checked="${nepaliScript}">${nepaliScript ? 'On' : 'Off'}</button></span><span class="reading-option"><span>Aa &nbsp; Latin-letter guides</span><button id="lesson-reading-toggle" role="switch" aria-label="Latin-letter guides" aria-checked="${readingHelp}">${readingHelp ? 'On' : 'Off'}</button></span></div>`;
  el('lesson-nepali-toggle').onclick = () => setNepaliScript(!nepaliScript);
  el('lesson-reading-toggle').onclick = () => setReadingHelp(!readingHelp);
  const select = (key: Move) => {
    el('word-explanation').textContent = pack.directions[key].lesson;
    document.querySelectorAll<HTMLElement>('[data-word]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.word === key)));
    el('intro-card').dataset.direction = key;
  };
  document.querySelectorAll<HTMLButtonElement>('[data-word]').forEach(button => button.onclick = () => select(button.dataset.word as Move));
  select('right');
  el('begin').onclick = () => {
    phase = 'practice'; el('welcome').hidden = true; render(); focusScene(); resetIdle();
    say('Let’s try it together.', pack.directions.right.lesson);
  };
  el('begin').focus();
}
function navigationMove(): Move {
  const target = phase === 'exit' ? 'exit' : 'at:4,3,N';
  return (routeTo(player, target)?.[0] ?? 'forward') as Move;
}
function render() {
  app.dataset.phase = phase;
  const inStore = !outside(player) && !['story', 'learn', 'complete'].includes(phase);
  radio.setInside(inStore);
  effects.setActive(inStore);
  scene?.setPlayer(player);
  scene?.setHighlight(phase === 'shop' ? misses >= 3 ? baseBeats[index].expect.replace('take:', '') : facedRack(player)?.id : undefined);
  el('facing').textContent = player.facing;
  el('position').textContent = `Tile ${player.col}, ${player.row} · Facing ${player.facing}`;
  const teaching = phase === 'practice';
  const word = teaching ? pack.directions[practice[practiceIndex]] : phase === 'shop' ? pack.words[baseBeats[index].cue] : pack.directions[navigationMove()];
  el('target').textContent = word.text;
  el('pronunciation').textContent = word.roman;
  app.dataset.readingHelp = String(readingHelp);
  app.dataset.nepaliScript = String(nepaliScript);
  el('caption').textContent = word.en;
  el('caption').hidden = !teaching && misses < 2;
  document.querySelector<HTMLElement>('.cue')!.hidden = ['story', 'learn', 'scanning', 'complete'].includes(phase) || (['checkout', 'collect'].includes(phase) && atCheckout(player));
  el('mission-label').textContent = teaching ? `GUIDED PRACTICE · ${practiceIndex + 1} / 4` : 'YOUR FIRST ERRAND';
  const item = racks.find(r => `take:${r.id}` === baseBeats[index]?.expect)?.item;
  const objectives: Record<Phase, string> = {
    story: 'A short list. A little adventure.', learn: 'Four words to find your way.',
    practice: `${pack.directions[practice[practiceIndex]].en} · ${pack.directions[practice[practiceIndex]].key}`,
    shop: `Find and take: ${item ? pack.items[item].toLowerCase() : ''}`,
    checkout: atCheckout(player) ? 'Put your four items on the counter' : 'Bring your items to the counter',
    scanning: 'The shopkeeper is scanning your items', collect: atCheckout(player) ? 'Your shopping is packed. Pick it up!' : 'Pick up your packed bag at the counter',
    exit: 'Take your shopping and walk out the door', complete: 'First errand complete. Welcome home!',
  };
  el('objective').textContent = objectives[phase];
  const picked = stock.filter(unit => unit.taken);
  el('order').innerHTML = ['Bag', 'Fruit', 'Fruit', 'Bottle'].map((label, i) => `<span class="order-item ${i < picked.length ? 'collected' : ''}">${i < picked.length ? '✓ ' : ''}${label}</span>`).join('');
  renderStock();
  const total = teaching ? 4 : 6;
  const active = teaching ? practiceIndex : phase === 'shop' ? index : ['checkout', 'scanning', 'collect'].includes(phase) ? 4 : phase === 'exit' ? 5 : phase === 'complete' ? 6 : 0;
  el('pips').setAttribute('aria-label', teaching ? `Practice ${practiceIndex + 1} of 4` : `Step ${Math.min(active + 1, 6)} of 6`);
  el('pips').innerHTML = Array.from({ length: total }, (_, i) => `<span class="pip ${i < active ? 'done' : i === active ? 'active' : ''}">${i < active ? '✓' : ''}</span>`).join('');
  const inactive = busy || ['story', 'learn', 'scanning', 'complete'].includes(phase);
  document.querySelectorAll<HTMLButtonElement>('[data-action], #help').forEach(button => button.disabled = inactive);
  const labels: Partial<Record<Phase, string>> = { checkout: 'Place items', scanning: 'Scanning…', collect: 'Pick up bag', exit: 'Bag packed ✓', complete: 'Done ✓' };
  const label = labels[phase] ?? 'Take 1';
  el('interact').innerHTML = `${label}<small>SPACE</small>`;
  el('interact').setAttribute('aria-label', phase === 'shop' ? 'Take one item' : label);
  (el('interact') as HTMLButtonElement).disabled = inactive || phase === 'practice' || phase === 'exit';
  const map = document.getElementById('map');
  if (map) map.innerHTML = Array.from({ length: 81 }, (_, n) => { const col = n % 9, row = Math.floor(n / 9); const rack = racks.find(r => r.col === col && r.row === row); return `<span class="map-tile ${rack ? 'rack' : ''}" title="${rack ? pack.items[rack.item] : ''}">${player.col === col && player.row === row ? ({ N:'↑', E:'→', S:'↓', W:'←' }[player.facing]) : rack ? pack.items[rack.item][0] : col === 4 && row === 8 ? '⇩' : col === 0 || col === 8 || row === 0 || row === 8 ? '▪' : ''}</span>`; }).join('');
}
function renderStock() {
  const picked = stock.filter(unit => unit.taken);
  const contents = (['bag', 'fruit', 'bottle', 'book'] as Item[]).map(item => {
    const count = picked.filter(unit => unit.item === item).length;
    return count ? `${pack.items[item]} × ${count}` : '';
  }).filter(Boolean).join(' · ');
  el('basket').textContent = phase === 'exit' || phase === 'complete' ? '✓ Carrying your packed shopping' : phase === 'collect' ? '✓ All four items scanned & packed' : phase === 'scanning' ? 'Your items are on the counter' : picked.length ? `In your basket: ${contents}` : 'Your basket is empty';
  el('basket').dataset.count = String(picked.length);
  const rack = facedRack(player);
  el('shelf-stock').hidden = !rack || phase !== 'shop';
  if (rack) {
    const remaining = stock.filter(unit => unit.rackId === rack.id && !unit.taken).length;
    el('shelf-stock').textContent = `${pack.items[rack.item]} · ${remaining} on shelf · Take one`;
    el('shelf-stock').dataset.remaining = String(remaining);
  }
}
function miss() {
  misses++;
  say('Almost. Try again.', phase === 'practice' ? pack.directions[practice[practiceIndex]].lesson : misses >= 3 ? 'Follow the gold outline, or tap ? for the next step.' : pack.words[baseBeats[index].cue].en);
  pulseCue(); render();
}
function move(action: string) {
  if (action === 'left' || action === 'right') player = turn(player, action === 'left' ? -1 : 1);
  if (action === 'forward' || action === 'backward') {
    const next = step(player, action === 'backward', phase === 'exit');
    if (next === player) {
      say(player.col === 4 && player.row === 7 ? 'Visit the counter before you leave.' : 'There’s something in the way.', 'Turn toward the open aisle.'); return false;
    }
    player = next;
  }
  return true;
}
function act(action: string, rackId?: string, unitId?: string) {
  if (busy || ['story', 'learn', 'scanning', 'complete'].includes(phase)) return;
  resetIdle();
  if (phase === 'practice') {
    const key = practice[practiceIndex], word = pack.directions[key];
    if (action !== word.action) { miss(); return; }
    move(action);
    if (action === 'forward' || action === 'backward') effects.footstep();
    outcomes.push({ text: word.text, en: word.en, misses, helped });
    busy = true; render(); say('That’s it. You did it!', key === 'backward' ? 'You stepped back without turning. All four words tried!' : word.lesson);
    advanceTimer = setTimeout(() => {
      busy = false; misses = 0; helped = false;
      if (practiceIndex === 3) { phase = 'shop'; say('Now for your first errand.', 'Find the reusable bag on the left side of the shop. Sides are named from the entrance.'); }
      else { practiceIndex++; say('Your next move.', pack.directions[practice[practiceIndex]].lesson); }
      render(); pulseCue();
    }, 650);
    return;
  }
  if (action !== 'take') {
    if (!move(action)) return;
    if (action === 'forward' || action === 'backward') effects.footstep();
    render();
    if (phase === 'exit' && outside(player)) {
      busy = true; render(); advanceTimer = setTimeout(finish, 300);
    }
    return;
  }
  if (phase === 'checkout' || phase === 'collect') {
    if (!atCheckout(player)) { say('Meet the shopkeeper at the counter.', 'Stand in the middle aisle, three tiles from the back wall, facing the counter. Tap ? for directions.'); return; }
    if (phase === 'checkout') startCheckout();
    else {
      scene?.collectPackedBag(); effects.bagRustle(); phase = 'exit'; render(); pulseCue();
      say('“All packed. Have a lovely day!”', 'Take your shopping out through the entrance. The lesson ends outside.');
    }
    return;
  }
  if (phase !== 'shop') return;
  const rack = facedRack(player), beat = baseBeats[index];
  if (!rack || (rackId && rack.id !== rackId) || beat.expect !== `take:${rack.id}`) { miss(); return; }
  const unit = takeOne(stock, rack.id, unitId);
  if (!unit) { say('That item is already in your basket.', 'Choose another item on this shelf.'); return; }
  scene?.takeUnit(unit.id);
  if (unit.item === 'bag') effects.bagRustle();
  if (unit.item === 'fruit') effects.fruitPickup();
  if (unit.item === 'bottle') effects.bottlePickup();
  const word = pack.words[beat.cue]; outcomes.push({ text: word.text, en: word.en, misses, helped });
  busy = true; render(); say('Nice. That was right.', 'One item added to your basket.');
  advanceTimer = setTimeout(() => {
    busy = false; misses = 0; helped = false;
    if (index === baseBeats.length - 1) { phase = 'checkout'; say('You found everything on your list.', 'Bring your four items to the counter. Follow the floating direction, or tap ? for a nudge.'); }
    else { index++; say('What’s next on your list?', 'Find the requested item on that side of the shop.'); }
    render(); pulseCue();
  }, 850);
}
function startCheckout() {
  phase = 'scanning'; render(); clearTimeout(idleTimer);
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
    phase = 'collect'; el('checkout-status').hidden = true; render();
    say('“Here you are. All packed!”', 'Pick up the packed bag from the counter, then head for the door.');
  };
  const ids = stock.filter(unit => unit.taken).map(unit => unit.id);
  if (scene) scene.beginCheckout(ids, onScan, ready);
  else {
    const tick = (count: number) => { onScan(count); fallbackTimer = setTimeout(() => count === 4 ? ready() : tick(count + 1), count === 4 ? 600 : 1100); };
    fallbackTimer = setTimeout(() => tick(0), 650);
  }
}
function finish() {
  // Completion is tied to crossing the doorway with the packed shopping.
  if (phase !== 'exit' || !outside(player)) return;
  phase = 'complete'; busy = false; clearTimeout(idleTimer); render();
  effects.levelComplete();
  try { completeLevel(localStorage, 'little-shop'); } catch { /* Play works without storage. */ }
  const mastered = outcomes.filter(outcome => !outcome.misses && !outcome.helped).length;
  const celebration = Array.from({ length: 16 }, (_, i) => `<i style="--angle:${i * 22.5}deg;--distance:${54 + i % 3 * 14}px;--delay:${i % 4 * 45}ms">${i % 3 ? '✦' : '●'}</i>`).join('');
  el('results').hidden = false;
  el('results').innerHTML = `<div class="completion-celebration" aria-hidden="true"><div class="completion-sparks">${celebration}</div><div class="completion-medal"><span>✓</span></div></div><div class="eyebrow">CHAPTER 01 · COMPLETE</div><h2>Your first errand. Done.</h2><p>You found your items, checked out, and walked home with your shopping.</p><div class="recap-words">${practice.map(key => { const word = pack.directions[key]; return `<div><strong lang="ne">${word.text}</strong><span>${word.roman} · ${word.en}</span></div>`; }).join('')}</div><p>${mastered} first-try successes · ${outcomes.length - mastered} practiced with help</p><button id="again" class="primary">Play the story again ↗</button>${import.meta.env.BASE_URL === '/game/' ? '<a class="primary map-return" href="/map/index.html">Back to your map ↗</a>' : ''}`;
  el('again').onclick = restart; el('again').focus(); say('A little more at home.', 'Four words you’ve put into practice.');
}
function restart() {
  run++; clearTimeout(advanceTimer); clearTimeout(idleTimer); clearTimeout(fallbackTimer);
  effects.cancel();
  phase = 'story'; player = start(); practiceIndex = 0; index = 0; misses = 0; helped = false; busy = false; stock = createStock(); outcomes = [];
  scene?.resetStock(); scene?.setPlayer(player, true);
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
  if (!['story', 'learn', 'complete'].includes(phase)) focusScene();
};
el('help').onclick = () => {
  if (busy || ['story', 'learn', 'scanning', 'complete'].includes(phase)) return;
  helped = true;
  if (phase === 'practice') { say('A little nudge.', `${pack.directions[practice[practiceIndex]].lesson} Use ${pack.directions[practice[practiceIndex]].key}.`); return; }
  const next = phase === 'shop' ? routeTo(player, baseBeats[index].expect)?.[0] : routeTo(player, phase === 'exit' ? 'exit' : 'at:4,3,N')?.[0];
  say('A little nudge.', ({ left:'Turn left.', right:'Turn right.', forward:'Take one step forward.', backward:'Take one step backward.', take:'Take one item from the shelf ahead.' } as Record<string, string>)[next ?? ''] ?? (phase === 'checkout' ? 'Place your items on the counter.' : 'Pick up your packed bag.'));
};
el('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { say('The shop already fills this window.', 'Your browser may not support hiding its toolbar.'); }
};
document.addEventListener('fullscreenchange', () => el('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'));
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;
  const action = ({ ArrowLeft:'left', ArrowRight:'right', ArrowUp:'forward', ArrowDown:'backward', ' ':'take' } as Record<string, string>)[event.key];
  if (action) { event.preventDefault(); if (!event.repeat) act(action); }
});
el('welcome').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const buttons = Array.from(el('welcome').querySelectorAll<HTMLButtonElement>('button'));
  const first = buttons[0], last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
window.addEventListener('pagehide', () => { effects.dispose(); radio.dispose(); }, { once: true });
restart();
