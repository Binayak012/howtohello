import { setupLetterPronunciation, speakerIcon } from './letter-pronunciation';
import { pencilSvg } from './pencil';
import { writingLessons } from './writing-strokes';
import { setupWritingGuide } from './writing-guide';
import { setupTraceCelebration } from './trace-celebration';
import { evaluateTrace } from '../../src/unit-unlock';
import { tracedLetters, saveTracedLetter, writingSets, canPracticeSet, type WritingSetId } from '../../src/tracing-progress';
import { completeLevel, levelHref, nextLevel } from '../../src/progression';
import { mountDemoSkip } from '../../src/demo-skip';
import { mountLessonSettings } from '../../src/lesson-settings';

// Temporary hackathon shortcut; set VITE_DEMO_SKIP_TRACING=false to hide it.
const demoSkipEnabled = import.meta.env.VITE_DEMO_SKIP_TRACING !== 'false';
const demoSkipButton = demoSkipEnabled ? '<button type="button" class="demo-trace-skip">Skip for demo <span aria-hidden="true">→</span></button>' : '';

/** Chapter 4, Your First Letters: trace five vowels after Counting with Lila, then continue to the shop. */
export function renderBasicUnit(app: HTMLDivElement, brand: string): () => void {
  mountDemoSkip(true, 'letters');
  const cleanupSettings = mountLessonSettings(app);
  const stores: Storage[] = [];
  try { stores.push(localStorage); } catch {}
  try { stores.push(sessionStorage); } catch {}
  const requestedSet = new URLSearchParams(location.search).get('set');
  let selected = writingSets.find(set => set.id === requestedSet && canPracticeSet(set.id, stores)) ?? writingSets[0];
  let letters: readonly string[] = selected.letters;
  const learned = new Set<string>();
  let tutorialSeen = false;
  let index = 0;
  function readProgress() {
    letters = selected.letters;
    learned.clear();
    for (const getStorage of [() => localStorage, () => sessionStorage]) {
      try { tracedLetters(getStorage(), selected.id).forEach(letter => learned.add(letter)); } catch {}
    }
    index = Math.max(0, letters.findIndex(letter => !learned.has(letter)));
  }
  readProgress();
  let finishTimer: number | undefined;
  let cleanupDrawing = () => {};
  let cleanupCelebration = () => {};
  const header = `<header class="nav wrap map-nav unit-nav">${brand}<a class="back-link" href="/map/index.html">← Back to map</a></header>`;
  function door() {
    window.clearTimeout(finishTimer);
    document.body.classList.add('is-tracing-screen');
    cleanupCelebration();
    cleanupDrawing();
    app.innerHTML = `${header}<main class="door-page wrap"><aside class="door-story"><p class="eyebrow">WRITING SIDE QUEST · ${selected.id === 'first-five' ? 'SET 01' : selected.id === 'second-five' ? 'SET 02' : 'EXTRA VOWELS'}</p><h1>Vowel practice.</h1><div class="writing-set-tabs" aria-label="Vowel practice sets">${writingSets.map((set,i) => `<button type="button" data-writing-set="${set.id}" aria-pressed="${set.id === selected.id}" ${canPracticeSet(set.id, stores) ? '' : `disabled title="Complete Lesson ${set.afterLesson} to unlock"`}>${canPracticeSet(set.id, stores) ? '' : '🔒 '}${i < 2 ? `Set ${i + 1}` : 'Extra vowels'}<small>${canPracticeSet(set.id, stores) ? set.letters.join(' ') : `After Lesson ${set.afterLesson}`}</small></button>`).join('')}</div><div class="practice-notebook" aria-hidden="true"><span lang="ne">${letters.slice(0,3).join(' ')}</span><span lang="ne">${letters.slice(3).join(' ')}</span><i>✦</i></div><div class="door-code" aria-label="Choose a letter to practice">${letters.map((letter, i) => `<button type="button" data-code="${i}" class="${i === index ? 'is-current' : ''} ${learned.has(letter) ? 'is-done' : ''}" aria-label="Practice ${letter}${learned.has(letter) ? ' · completed' : ''}" aria-pressed="${i === index}" lang="ne">${letter}</button>`).join('')}</div><p class="door-footnote">${learned.size}/${letters.length} traced</p></aside><section class="door-writing" aria-labelledby="trace-title"><p class="eyebrow" id="trace-step">LETTER ${index + 1} OF ${letters.length}</p><div class="trace-letter-heading"><h2 id="trace-title">Trace <span lang="ne">${letters[index]}</span></h2><button type="button" class="letter-speaker" id="hear-letter" aria-label="Hear अ pronounced in Nepali">${speakerIcon}</button></div><p id="letter-pronunciation" class="letter-pronunciation"></p><span id="letter-sound-status" class="sr-only" role="status" aria-live="polite"></span><p class="trace-instructions" id="trace-instructions">Trace the pale letter. Start at the gold dot.</p><div class="trace-tools"><button type="button" class="text-button trace-tutorial-open" aria-haspopup="dialog">How to trace ↗</button><button type="button" class="text-button trace-effects-toggle" aria-pressed="true">Effects: On</button>${demoSkipButton}</div><div class="trace-board"><canvas id="trace-target" width="280" height="240" aria-hidden="true"></canvas><canvas id="trace-ink" width="280" height="240" tabindex="0" aria-label="Trace the displayed Nepali letter with your mouse. A keyboard alternative is available below." aria-describedby="trace-instructions"></canvas></div><div class="trace-actions"><button class="text-button" id="trace-clear" type="button">Clear strokes ↺</button><button class="button primary" id="trace-check" type="button">Check letter <span aria-hidden="true">✓</span></button></div><p class="trace-feedback" id="trace-feedback" role="status" aria-live="polite"></p><details class="trace-alternative"><summary>Use a keyboard instead</summary><form id="door-keyboard"><label for="door-passcode">Enter this set’s vowels in order</label><p lang="ne" class="keyboard-code">${letters.join(' ')}</p><input id="door-passcode" name="passcode" lang="ne" autocomplete="off" spellcheck="false" required aria-describedby="keyboard-help"><p id="keyboard-help">Typed practice is welcome, but only drawing a letter counts toward tracing progress.</p><button class="button primary" type="submit">Check typed letters ↗</button></form></details><p id="practice-info-feedback" role="status"></p></section></main>`;
    app.insertAdjacentHTML('beforeend', `<dialog class="writing-tutorial" aria-labelledby="writing-tutorial-title"><div class="tutorial-pencil" aria-hidden="true">${pencilSvg}</div><p class="eyebrow">A LITTLE WRITING WARM-UP</p><h2 id="writing-tutorial-title">Meet your pencil.</h2><p>Watch the pencil, then trace the letter.</p><p id="stroke-guidance"></p><ol><li><span class="tutorial-dot">1</span><div><strong>Find your starting point</strong><p>The gold dot marks where the next stroke begins.</p></div></li><li><span>↗</span><div><strong>Follow the pencil</strong><p>Hold the mouse button and draw along the pale guide.</p></div></li><li><span>↥</span><div><strong>Lift, then begin again</strong><p>Release the mouse between strokes. Replay a numbered step whenever you need.</p></div></li></ol><button type="button" class="button primary" id="tutorial-watch">Watch the pencil <span aria-hidden="true">↗</span></button><button type="button" class="text-button" id="tutorial-skip">I’m ready to try</button>${demoSkipButton}</dialog>`);
    setupDrawing();
    app.querySelectorAll<HTMLButtonElement>('[data-writing-set]').forEach(button => { button.onclick = () => {
      const next = writingSets.find(set => set.id === button.dataset.writingSet as WritingSetId);
      if (!next || !canPracticeSet(next.id, stores)) return;
      selected = next;
      const url = new URL(location.href); url.searchParams.set('set', selected.id); history.replaceState({},'',url);
      readProgress(); door();
    }; });
    app.querySelectorAll<HTMLButtonElement>('[data-code]').forEach(button => { button.onclick = () => { index = Number(button.dataset.code); door(); }; });
    app.querySelectorAll<HTMLButtonElement>('.demo-trace-skip').forEach(button => button.onclick = skipForDemo);
  }
  function skipForDemo() {
    if (demoSkipEnabled) location.assign('/map/index.html');
  }
  function unlock() {
    // Finishing the first five vowels completes story chapter 04 and opens the shop.
    const storyChapter = selected.id === 'first-five';
    if (storyChapter) { try { completeLevel(localStorage, 'letters'); } catch { /* Progress saving is optional. */ } }
    cleanupDrawing();
    app.querySelectorAll('[data-code]').forEach(slot => { slot.classList.add('is-done'); slot.classList.remove('is-current'); });
    const panel = app.querySelector<HTMLElement>('.door-writing')!;
    panel.classList.add('door-writing-unlocked');
    panel.innerHTML = `<div class="door-success"><span class="door-success-mark">✓</span><p class="eyebrow">SIDE QUEST COMPLETE</p><h2>Set complete. Nicely done.</h2><p>${Number.isFinite(selected.beforeLesson) ? `Your writing prerequisite for Lesson ${selected.beforeLesson} is complete.` : 'You’ve completed the extra vowels.'} Keep playing the story, or return here to practice.</p>${storyChapter ? `<a class="button primary" id="next-chapter" href="${levelHref(nextLevel('letters')!, true)}">Start chapter 05 ↗</a><a class="text-button" href="/map/index.html">Back to map</a>` : '<a class="button primary" href="/map/index.html">Back to map ↗</a>'}<button class="text-button" id="practice-again">Practice again ↻</button></div>`;
    panel.querySelector<HTMLButtonElement>('#practice-again')!.onclick = () => { index = 0; door(); };
  }
  function setupDrawing() {
    const target = app.querySelector<HTMLCanvasElement>('#trace-target')!;
    const ink = app.querySelector<HTMLCanvasElement>('#trace-ink')!;
    const targetContext = target.getContext('2d')!;
    const context = ink.getContext('2d')!;
    const feedback = app.querySelector<HTMLElement>('#trace-feedback')!;
    const check = app.querySelector<HTMLButtonElement>('#trace-check')!;
    const celebration = setupTraceCelebration(app);
    cleanupCelebration = () => celebration.dispose();
    const pronunciation = setupLetterPronunciation(app, playing => celebration.setPronunciationPlaying(playing));
    let pointer: number | null = null;
    let last: { x: number; y: number } | null = null;
    let passed = false;
    function drawTarget() {
      targetContext.clearRect(0, 0, 280, 240);
      targetContext.strokeStyle = '#000';
      targetContext.lineWidth = 10;
      targetContext.lineCap = 'round'; targetContext.lineJoin = 'round';
      writingLessons.find(lesson => lesson.letter === letters[index])!.strokes.forEach(stroke => targetContext.stroke(new Path2D(stroke.path)));
    }
    drawTarget();
    const guide = setupWritingGuide(app.querySelector<HTMLElement>('.trace-board')!, message => { app.querySelector('#stroke-guidance')!.textContent = message; feedback.textContent = message.startsWith('Your turn') ? 'Your turn. Start at the gold dot.' : message.startsWith('Start') ? '' : 'Follow the pencil.'; });
    guide.prepare(writingLessons.findIndex(lesson => lesson.letter === letters[index]));
    pronunciation.update(writingLessons.findIndex(lesson => lesson.letter === letters[index]));
    const tutorial = app.querySelector<HTMLDialogElement>('.writing-tutorial')!;
    let demonstrateOnClose = false;
    tutorial.onclose = () => { if (demonstrateOnClose) guide.play(); demonstrateOnClose = false; };
    app.querySelector<HTMLButtonElement>('#tutorial-watch')!.onclick = () => { demonstrateOnClose = true; tutorial.close(); };
    app.querySelector<HTMLButtonElement>('#tutorial-skip')!.onclick = () => { demonstrateOnClose = false; tutorial.close(); ink.focus({ preventScroll: true }); };
    app.querySelector<HTMLButtonElement>('.trace-tutorial-open')!.onclick = () => { demonstrateOnClose = false; tutorial.showModal(); };
    if (!tutorialSeen) { tutorialSeen = true; tutorial.showModal(); }
    function point(event: PointerEvent) {
      const rect = ink.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * 280 / rect.width, y: (event.clientY - rect.top) * 240 / rect.height };
    }
    ink.onpointerdown = event => {
      if (passed || guide.playing || pointer !== null || event.button !== 0) return;
      celebration.stopPencil();
      guide.startPractice();
      event.preventDefault(); pointer = event.pointerId; ink.setPointerCapture(pointer);
      last = point(event);
      context.fillStyle = '#1f7a7a'; context.beginPath(); context.arc(last.x, last.y, 5, 0, Math.PI * 2); context.fill();
    };
    ink.onpointermove = event => {
      if (event.pointerId !== pointer || !last) return;
      const next = point(event);
      celebration.pencilMoved(Math.hypot(next.x - last.x, next.y - last.y));
      context.strokeStyle = '#1f7a7a'; context.lineWidth = 10; context.lineCap = 'round'; context.lineJoin = 'round';
      context.beginPath(); context.moveTo(last.x, last.y); context.lineTo(next.x, next.y); context.stroke(); last = next;
    };
    function endStroke() { celebration.stopPencil(); pointer = null; last = null; }
    ink.onpointerup = endStroke; ink.onpointercancel = endStroke; ink.onlostpointercapture = endStroke;
    app.querySelector<HTMLButtonElement>('#trace-clear')!.onclick = () => {
      if (passed) return;
      celebration.stopPencil();
      context.clearRect(0, 0, 280, 240); guide.reset();
    };
    function nextLetter() {
      index = (index + 1) % letters.length; passed = false; pronunciation.update(writingLessons.findIndex(lesson => lesson.letter === letters[index]));
      context.clearRect(0, 0, 280, 240); drawTarget(); guide.prepare(writingLessons.findIndex(lesson => lesson.letter === letters[index])); guide.play();
      app.querySelector('#trace-step')!.textContent = `LETTER ${index + 1} OF ${letters.length}`;
      app.querySelector('#trace-title')!.innerHTML = `Trace <span lang="ne">${letters[index]}</span>`;
      app.querySelectorAll<HTMLElement>('[data-code]').forEach((slot, i) => { slot.classList.toggle('is-done', learned.has(letters[i])); slot.setAttribute('aria-pressed', String(i === index)); slot.classList.toggle('is-current', i === index); });
      check.innerHTML = 'Check letter <span aria-hidden="true">✓</span>';
      ink.focus({ preventScroll: true });
    }
    check.onclick = () => {
      celebration.stopPencil();
      if (guide.playing) { feedback.textContent = 'Watch the pencil finish, or select Your turn to start drawing.'; return; }
      if (passed) { nextLetter(); return; }
      const userInk = context.getImageData(0, 0, 280, 240).data;
      const result = evaluateTrace(targetContext.getImageData(0, 0, 280, 240).data, userInk, 280, 240);
      const strokeCanvas = document.createElement('canvas');
      strokeCanvas.width = 280; strokeCanvas.height = 240;
      const strokeContext = strokeCanvas.getContext('2d')!;
      strokeContext.lineWidth = 10; strokeContext.lineCap = 'round'; strokeContext.lineJoin = 'round';
      const missingStroke = writingLessons.find(lesson => lesson.letter === letters[index])!.strokes.findIndex(stroke => {
        strokeContext.clearRect(0, 0, 280, 240);
        strokeContext.stroke(new Path2D(stroke.path));
        return evaluateTrace(strokeContext.getImageData(0, 0, 280, 240).data, userInk, 280, 240).coverage < .6;
      });
      if (result.accepted && missingStroke >= 0) {
        feedback.textContent = `Finish stroke ${missingStroke + 1}.`;
        celebration.mistake();
        return;
      }
      if (!result.accepted) {
        feedback.textContent = result.precision < .78 ? 'Stay a little closer to the pale letter. Clear your strokes and try again.' : 'Almost there. Trace the rest of the letter, including its top line.';
        celebration.mistake();
        return;
      }
      passed = true;
      learned.add(letters[index]);
      let saved = false;
      for (const getStorage of [() => localStorage, () => sessionStorage]) {
        try { for (const letter of learned) saved = saveTracedLetter(getStorage(), letter, selected.id) || saved; } catch {}
      }
      app.querySelector('.door-footnote')!.textContent = `${learned.size}/${letters.length} traced${saved ? '' : ' · Not saved'}`;
      app.querySelector(`[data-code="${index}"]`)!.classList.add('is-done');
      feedback.textContent = learned.size === letters.length ? 'All vowels in this set traced. Nicely done!' : 'Nice! Try the next letter.';
      celebration.acceptLetter(index, learned.size === letters.length);
      if (learned.size === letters.length) {
        check.disabled = true;
        check.textContent = 'Set complete ✓';
        finishTimer = window.setTimeout(unlock, matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 600);
        return;
      }
      check.textContent = 'Next letter →';
    };
    app.querySelector<HTMLFormElement>('#door-keyboard')!.onsubmit = event => {
      event.preventDefault();
      const value = app.querySelector<HTMLInputElement>('#door-passcode')!.value;
      const infoFeedback = app.querySelector<HTMLElement>('#practice-info-feedback')!;
      infoFeedback.textContent = value.normalize('NFC').replace(/\s/gu, '') === letters.join('') ? 'Correct. Draw each vowel to record tracing progress.' : `Use this order: ${letters.join(' ')}.`;
    };
    cleanupDrawing = () => { pronunciation.dispose(); tutorial.onclose = null; tutorial.close(); guide.dispose(); endStroke(); ink.onpointerdown = null; ink.onpointermove = null; ink.onpointerup = null; ink.onpointercancel = null; ink.onlostpointercapture = null; };
  }
  door();
  return () => { cleanupSettings(); window.clearTimeout(finishTimer); document.body.classList.remove('is-tracing-screen'); cleanupCelebration(); cleanupDrawing(); };
}
