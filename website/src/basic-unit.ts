import { setupLetterPronunciation, speakerIcon } from './letter-pronunciation';
import { unitDoorMarkup } from './unit-door';
import { pencilSvg } from './pencil';
import { writingLessons } from './writing-strokes';
import { setupWritingGuide } from './writing-guide';
import { basicPasscode, evaluateTrace, saveBasicUnlock, validPasscode } from '../../src/unit-unlock';
import { completeLevel, completedLevels, isUnlocked, journey, levelHref, nextLevel } from '../../src/progression';
import { mountDemoSkip } from '../../src/demo-skip';

/** Chapter 4, Your First Letters: trace five vowels after Counting with Lila, then continue to the shop. */
export function renderBasicUnit(app: HTMLDivElement, brand: string): () => void {
  mountDemoSkip(true, 'letters');
  let completed: ReturnType<typeof completedLevels> = [];
  let storageReadable = true;
  try { completed = completedLevels(localStorage); } catch { storageReadable = false; }
  let index = 0;
  let cleanupDrawing = () => {};
  const header = `<header class="nav wrap map-nav unit-nav">${brand}<a class="back-link" href="/map/index.html">← Back to map</a></header>`;
  const next = nextLevel('letters')!;
  function locked() {
    const previous = journey.find(level => level.id === 'counting')!;
    app.innerHTML = `${header}<main class="basic-unit-page wrap"><div class="basic-unit-heading"><p class="eyebrow">CHAPTER 04 · YOUR FIRST LETTERS</p><h1>A little earlier in the story…</h1><p>Your first letters open after chapter ${String(previous.chapter).padStart(2, '0')}, ${previous.title}.</p><a class="button primary" href="/map/index.html">Back to your journey <span aria-hidden="true">↗</span></a></div></main>`;
  }
  function lessons() {
    document.body.classList.remove('is-tracing-screen');
    cleanupDrawing();
    app.innerHTML = `${header}<main class="basic-unit-page wrap"><div class="basic-unit-heading"><p class="eyebrow">CHAPTER 04 · COMPLETE</p><h1>Your neighborhood<span class="unit-open-badge">✓</span></h1><p>Six chapters. One little beginning.</p><button type="button" class="text-button" id="practice-writing">Practice writing ↻</button></div><ol class="basic-lessons">${journey.map((level, i) => {
      const finished = completed.includes(level.id);
      const playable = level.implemented && isUnlocked(level.id, completed);
      return `<li class="basic-lesson ${playable ? 'is-ready' : ''}"><span class="basic-lesson-number">${finished ? '✓' : String(level.chapter).padStart(2, '0')}</span><div><small>${i === journey.length - 1 ? 'FINALE' : `CHAPTER ${level.chapter}`}</small><h2>${level.title}</h2><p>${finished ? 'Completed · Ready for another try?' : level.subtitle}</p></div>${playable ? `<a class="button primary" href="${levelHref(level, true)}">${finished ? 'Play again' : 'Let’s play'} <span aria-hidden="true">↗</span></a>` : `<button class="lesson-lock" disabled aria-label="Chapter ${level.chapter} locked">⌑</button>`}</li>`;
    }).join('')}</ol></main>`;
    app.querySelector<HTMLButtonElement>('#practice-writing')!.onclick = () => { index = 0; door(); };
  }
  function door() {
    document.body.classList.add('is-tracing-screen');
    cleanupDrawing();
    app.innerHTML = `${header}<main class="door-page wrap"><aside class="door-story"><p class="eyebrow">CHAPTER 04 · YOUR FIRST LETTERS</p><h1>A few letters.<br>A door opens.</h1><p>Lila’s notebook is open. Trace the first five Nepali vowels, then head out to the little shop.</p>${unitDoorMarkup}<div class="door-code" aria-label="Passcode progress">${basicPasscode.map((letter, i) => `<span data-code="${i}" class="${i === index ? 'is-current' : ''}" lang="ne">${letter}</span>`).join('')}</div><p class="door-footnote">A little practice is your key.</p></aside><section class="door-writing" aria-labelledby="trace-title"><p class="eyebrow" id="trace-step">LETTER 1 OF 5</p><div class="trace-letter-heading"><h2 id="trace-title">Trace <span lang="ne">अ</span> to begin</h2><button type="button" class="letter-speaker" id="hear-letter" aria-label="Hear अ pronounced in Nepali">${speakerIcon}</button></div><p id="letter-pronunciation" class="letter-pronunciation"></p><span id="letter-sound-status" class="sr-only" role="status" aria-live="polite"></span><p class="trace-instructions" id="trace-instructions">Follow the pencil. Start at the gold dot and lift between strokes.</p><button type="button" class="text-button trace-tutorial-open">How to trace ↗</button><div class="trace-board"><canvas id="trace-target" width="280" height="240" aria-hidden="true"></canvas><canvas id="trace-ink" width="280" height="240" tabindex="0" aria-label="Trace the displayed Nepali letter with your mouse. A keyboard alternative is available below." aria-describedby="trace-instructions"></canvas></div><div class="trace-actions"><button class="text-button" id="trace-clear" type="button">Clear strokes ↺</button><button class="button primary" id="trace-check" type="button">Check letter <span aria-hidden="true">✓</span></button></div><p class="trace-feedback" id="trace-feedback" role="status" aria-live="polite">Follow the pale letter, including the top line.</p><details class="trace-alternative"><summary>Use a keyboard instead</summary><form id="door-keyboard"><label for="door-passcode">Enter the five letters in order</label><p lang="ne" class="keyboard-code">अ आ इ ई उ</p><input id="door-passcode" name="passcode" lang="ne" autocomplete="off" spellcheck="false" required aria-describedby="keyboard-help"><p id="keyboard-help">Use a Nepali keyboard. Spaces between letters are optional.</p><button class="button primary" type="submit">Finish chapter 04 ↗</button></form></details></section></main>`;
    app.insertAdjacentHTML('beforeend', `<dialog class="writing-tutorial" aria-labelledby="writing-tutorial-title"><div class="tutorial-pencil" aria-hidden="true">${pencilSvg}</div><p class="eyebrow">A LITTLE WRITING WARM-UP</p><h2 id="writing-tutorial-title">Meet your pencil.</h2><p>Watch how each letter is built, one stroke at a time.</p><ol><li><span class="tutorial-dot">1</span><div><strong>Find your starting point</strong><p>The gold dot marks where the next stroke begins.</p></div></li><li><span>↗</span><div><strong>Follow the pencil</strong><p>Hold the mouse button and draw along the pale guide.</p></div></li><li><span>↥</span><div><strong>Lift, then begin again</strong><p>Release the mouse between strokes. Replay a numbered step whenever you need.</p></div></li></ol><button type="button" class="button primary" id="tutorial-watch">Show me the first letter <span aria-hidden="true">↗</span></button><button type="button" class="text-button" id="tutorial-skip">I’m ready to try</button></dialog>`);
    setupDrawing();
  }
  function unlock() {
    let saved = false;
    try { saved = completeLevel(localStorage, 'letters'); saveBasicUnlock(localStorage); } catch { /* Progress saving is optional. */ }
    try { saveBasicUnlock(sessionStorage); } catch { /* Optional fallback. */ }
    try { completed = completedLevels(localStorage); } catch { /* Keep the earlier list. */ }
    cleanupDrawing();
    const door = app.querySelector('.unit-portal');
    door?.classList.add('is-open');
    const panel = app.querySelector<HTMLElement>('.door-writing')!;
    panel.classList.add('door-writing-unlocked');
    app.querySelectorAll('[data-code]').forEach(slot => { slot.classList.add('is-done'); slot.classList.remove('is-current'); });
    const chapter = String(next.chapter).padStart(2, '0');
    panel.innerHTML = `<div class="door-success"><span class="door-success-mark">✓</span><p class="eyebrow">CHAPTER 04 · COMPLETE</p><h2>Five letters, written.</h2><p>Up next: chapter ${chapter}, ${next.title}. ${saved ? 'Your progress is saved on this browser.' : 'Progress saving is unavailable, so later chapters may stay locked.'}</p><div class="door-success-actions"><a class="button primary" id="next-chapter" href="${levelHref(next, true)}">Start chapter ${chapter} <span aria-hidden="true">↗</span></a><button class="text-button" id="enter-basic">See your journey</button></div></div>`;
    panel.querySelector<HTMLButtonElement>('#enter-basic')!.onclick = () => { lessons(); app.querySelector<HTMLAnchorElement>('.basic-lessons a')?.focus(); };
    panel.querySelector<HTMLAnchorElement>('#next-chapter')!.focus();
  }
  function setupDrawing() {
    const target = app.querySelector<HTMLCanvasElement>('#trace-target')!;
    const ink = app.querySelector<HTMLCanvasElement>('#trace-ink')!;
    const targetContext = target.getContext('2d')!;
    const context = ink.getContext('2d')!;
    const feedback = app.querySelector<HTMLElement>('#trace-feedback')!;
    const check = app.querySelector<HTMLButtonElement>('#trace-check')!;
    const pronunciation = setupLetterPronunciation(app.querySelector<HTMLElement>('.door-writing')!);
    let pointer: number | null = null;
    let last: { x: number; y: number } | null = null;
    let passed = false;
    function drawTarget() {
      targetContext.clearRect(0, 0, 280, 240);
      targetContext.strokeStyle = '#000';
      targetContext.lineWidth = 10;
      targetContext.lineCap = 'round'; targetContext.lineJoin = 'round';
      writingLessons[index].strokes.forEach(stroke => targetContext.stroke(new Path2D(stroke.path)));
    }
    drawTarget();
    const guide = setupWritingGuide(app.querySelector<HTMLElement>('.trace-board')!, message => { feedback.textContent = message; });
    guide.prepare(index);
    const tutorial = app.querySelector<HTMLDialogElement>('.writing-tutorial')!;
    let demonstrateOnClose = true;
    tutorial.onclose = () => { if (demonstrateOnClose) guide.play(); };
    app.querySelector<HTMLButtonElement>('#tutorial-watch')!.onclick = () => { demonstrateOnClose = true; tutorial.close(); };
    app.querySelector<HTMLButtonElement>('#tutorial-skip')!.onclick = () => { demonstrateOnClose = false; tutorial.close(); ink.focus({ preventScroll: true }); };
    app.querySelector<HTMLButtonElement>('.trace-tutorial-open')!.onclick = () => { demonstrateOnClose = true; tutorial.showModal(); };
    tutorial.showModal();
    function point(event: PointerEvent) {
      const rect = ink.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * 280 / rect.width, y: (event.clientY - rect.top) * 240 / rect.height };
    }
    ink.onpointerdown = event => {
      if (passed || guide.playing || pointer !== null || event.button !== 0) return;
      guide.startPractice();
      event.preventDefault(); pointer = event.pointerId; ink.setPointerCapture(pointer);
      last = point(event);
      context.fillStyle = '#1f7a7a'; context.beginPath(); context.arc(last.x, last.y, 5, 0, Math.PI * 2); context.fill();
    };
    ink.onpointermove = event => {
      if (event.pointerId !== pointer || !last) return;
      const next = point(event);
      context.strokeStyle = '#1f7a7a'; context.lineWidth = 10; context.lineCap = 'round'; context.lineJoin = 'round';
      context.beginPath(); context.moveTo(last.x, last.y); context.lineTo(next.x, next.y); context.stroke(); last = next;
    };
    function endStroke() { pointer = null; last = null; }
    ink.onpointerup = endStroke; ink.onpointercancel = endStroke; ink.onlostpointercapture = endStroke;
    app.querySelector<HTMLButtonElement>('#trace-clear')!.onclick = () => {
      if (passed) return;
      context.clearRect(0, 0, 280, 240); guide.reset();
    };
    function nextLetter() {
      index++; passed = false; pronunciation.update(index);
      context.clearRect(0, 0, 280, 240); drawTarget(); guide.prepare(index); guide.play();
      app.querySelector('#trace-step')!.textContent = `LETTER ${index + 1} OF 5`;
      app.querySelector('#trace-title')!.innerHTML = `Trace <span lang="ne">${basicPasscode[index]}</span>`;
      app.querySelectorAll<HTMLElement>('[data-code]').forEach((slot, i) => { slot.classList.toggle('is-done', i < index); slot.classList.toggle('is-current', i === index); });
      check.innerHTML = 'Check letter <span aria-hidden="true">✓</span>';
      ink.focus({ preventScroll: true });
    }
    check.onclick = () => {
      if (guide.playing) { feedback.textContent = 'Watch the pencil finish, or select Your turn to start drawing.'; return; }
      if (passed) { if (index === 4) unlock(); else nextLetter(); return; }
      const userInk = context.getImageData(0, 0, 280, 240).data;
      const result = evaluateTrace(targetContext.getImageData(0, 0, 280, 240).data, userInk, 280, 240);
      const strokeCanvas = document.createElement('canvas');
      strokeCanvas.width = 280; strokeCanvas.height = 240;
      const strokeContext = strokeCanvas.getContext('2d')!;
      strokeContext.lineWidth = 10; strokeContext.lineCap = 'round'; strokeContext.lineJoin = 'round';
      const missingStroke = writingLessons[index].strokes.findIndex(stroke => {
        strokeContext.clearRect(0, 0, 280, 240);
        strokeContext.stroke(new Path2D(stroke.path));
        return evaluateTrace(strokeContext.getImageData(0, 0, 280, 240).data, userInk, 280, 240).coverage < .6;
      });
      if (result.accepted && missingStroke >= 0) {
        feedback.textContent = `Finish stroke ${missingStroke + 1}. ${writingLessons[index].strokes[missingStroke].instruction}`;
        return;
      }
      if (!result.accepted) {
        feedback.textContent = result.precision < .78 ? 'Stay a little closer to the pale letter. Clear your strokes and try again.' : 'Almost there. Trace the rest of the letter, including its top line.';
        return;
      }
      passed = true;
      app.querySelector(`[data-code="${index}"]`)!.classList.add('is-done');
      feedback.textContent = index === 4 ? 'All five letters complete. Your door is ready to open.' : 'Nice! That letter is your next piece of the passcode.';
      check.textContent = index === 4 ? 'Finish chapter 04 ↗' : 'Next letter →';
    };
    app.querySelector<HTMLFormElement>('#door-keyboard')!.onsubmit = event => {
      event.preventDefault();
      const value = app.querySelector<HTMLInputElement>('#door-passcode')!.value;
      if (validPasscode(value)) unlock();
      else feedback.textContent = 'Use the five letters in this order: अ आ इ ई उ.';
    };
    cleanupDrawing = () => { pronunciation.dispose(); tutorial.onclose = null; tutorial.close(); guide.dispose(); endStroke(); ink.onpointerdown = null; ink.onpointermove = null; ink.onpointerup = null; ink.onpointercancel = null; ink.onlostpointercapture = null; };
  }
  // Without readable storage we can't know progress, so let the learner trace rather than lock them out.
  if (completed.includes('letters')) lessons();
  else if (storageReadable && !isUnlocked('letters', completed)) locked();
  else door();
  return () => { document.body.classList.remove('is-tracing-screen'); cleanupDrawing(); };
}
