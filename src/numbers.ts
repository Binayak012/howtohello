// Nepali cardinals cross-checked against Introduction to the Nepali Language:
// https://pressbooks.bccampus.ca/nepali/chapter/chapter-1-unit-9-numerals/
// Latin spellings are approximate reading guides, consistent with the shop lesson.
export const numbers = [
  { value: 1, digit: '१', word: 'एक', roman: 'ek', english: 'One' },
  { value: 2, digit: '२', word: 'दुई', roman: 'dui', english: 'Two' },
  { value: 3, digit: '३', word: 'तीन', roman: 'teen', english: 'Three' },
  { value: 4, digit: '४', word: 'चार', roman: 'chaar', english: 'Four' },
  { value: 5, digit: '५', word: 'पाँच', roman: 'paanch', english: 'Five' },
] as const;

export const apple = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 19c-3-7-15-9-21-1C1 31 15 56 25 56c4 0 5-2 7-2s4 2 8 2c11 0 23-26 14-38-6-8-18-6-22 1Z" fill="#df7254"/><path d="M18 20c-8 5-6 16-3 20" fill="none" stroke="#f8b18a" stroke-width="4" stroke-linecap="round"/><path d="M32 20c-2-6-1-12 3-16" fill="none" stroke="#7a583d" stroke-width="4" stroke-linecap="round"/><path d="M34 13C35 3 46 3 49 6c-2 7-8 11-15 7Z" fill="#6f9874"/></svg>';

/** A short introduction; successful recall releases the learner into the street. */
export class NumberLesson {
  private stage: 'learn' | 'check' | 'done' = 'learn';
  private index = 0;
  private visited = new Set([0]);
  private checkIndex = 0;
  private solved = false;
  private checkOrder = [3, 1, 5, 2, 4];
  private body: HTMLElement;
  private status: HTMLElement;

  constructor(private host: HTMLElement, private onComplete: () => void, private onClose: () => void) {
    host.hidden = false;
    host.innerHTML = `<article class="numbers-panel"><header class="numbers-header"><span class="eyebrow">THE MORNING MARKET · NUMBERS 1–5</span><button type="button" data-number-action="close" class="quiet">Back to market</button></header><div class="numbers-body"></div><p class="numbers-feedback" role="status" aria-live="polite" tabindex="-1"></p></article>`;
    this.body = host.querySelector('.numbers-body')!;
    this.status = host.querySelector('.numbers-feedback')!;
    host.addEventListener('click', this.click); this.render();
  }
  private fruits(count: number, labelled = false) {
    return `<div class="count-fruits" role="img" aria-label="${count} ${count === 1 ? 'apple' : 'apples'}">${Array.from({ length: count }, (_, i) => `<span class="count-fruit">${apple}${labelled ? `<small>${i + 1}</small>` : ''}</span>`).join('')}</div>`;
  }
  private render(focus = '#numbers-title', message = '') {
    this.host.dataset.stage = this.stage;
    const current = numbers[this.index];
    const step = this.stage === 'learn' ? 1 : 2;
    let content = `<div class="number-stages" aria-label="${this.stage === 'done' ? 'Lesson complete' : `Step ${step} of 2`}"><span class="${step === 1 ? 'current' : ''}">01 · Learn</span><span class="${step === 2 ? 'current' : ''}">02 · Try</span><span>Then · Explore freely</span></div>`;
    if (this.stage === 'learn') {
      const ready = this.visited.size === numbers.length;
      content += `<h2 id="numbers-title" tabindex="-1">A little counting.<br> A new kind of adventure.</h2><p class="numbers-intro">Before we shop, let’s learn five numbers.<br>Match the word to the apples, one at a time.</p>
      <div class="number-study"><div class="number-numerals"><span>${current.value}</span><span lang="ne">${current.digit}</span></div><strong class="number-word" lang="ne">${current.word}</strong><span class="number-roman latin-guide" lang="ne-Latn">${current.roman}</span><span class="number-meaning">${current.english}</span>${this.fruits(current.value, true)}</div>
      <nav class="number-tabs" aria-label="Explore numbers">${numbers.map((number, i) => `<button type="button" data-number-index="${i}" aria-label="Learn ${number.english.toLowerCase()}" aria-pressed="${i === this.index}"><span>${number.value}</span><small>${this.visited.has(i) ? '✓' : '·'}</small></button>`).join('')}</nav>
      <p class="number-help">${ready ? 'You’ve explored all five. Let’s see what you remember.' : `${this.visited.size} of 5 explored · Visit every number before practicing.`}</p>
      <div class="number-actions"><button class="quiet" data-number-action="previous" ${this.index === 0 ? 'disabled' : ''}>Previous</button><button class="primary" id="number-next" data-number-action="${this.index < 4 ? 'next' : ready ? 'practice' : 'unseen'}">${this.index < 4 ? 'Next number →' : ready ? 'Let’s try the numbers ↗' : 'Explore the other numbers →'}</button></div>`;
    } else if (this.stage === 'check') {
      const number = numbers[this.checkOrder[this.checkIndex] - 1];
      content += `<p class="eyebrow number-round">QUICK PRACTICE · ${this.checkIndex + 1} / 5</p><h2 id="numbers-title" tabindex="-1">Which number is this?</h2><p class="numbers-intro">Choose the matching number. Take your time.</p><div class="number-prompt"><strong class="number-word" lang="ne">${number.word}</strong><span class="number-roman latin-guide" lang="ne-Latn">${number.roman}</span></div>
      <div class="number-answers" aria-label="Number choices">${[2, 5, 1, 4, 3].map(value => `<button data-number-answer="${value}" aria-label="Answer ${value}" ${this.solved ? 'disabled' : ''}>${value}</button>`).join('')}</div>
      ${this.solved ? `${this.fruits(number.value)}<button class="primary number-continue" id="number-next" data-number-action="advance">${this.checkIndex === 4 ? 'Ready to explore ↗' : 'Next number →'}</button>` : ''}<button class="number-review" data-number-action="review">Review the numbers</button>`;
    } else {
      content += `<span class="number-win" aria-hidden="true">✓</span><p class="eyebrow">READY FOR THE NEIGHBORHOOD</p><h2 id="numbers-title" tabindex="-1">Five numbers.<br> A street full of possibilities.</h2><p class="numbers-intro">The lesson is done. Walk wherever you like.<br>Greet a stall keeper, use your numbers, or help a neighbor.</p><div class="number-recap">${numbers.map(number => `<span><b>${number.value}</b><strong lang="ne">${number.word}</strong><small class="latin-guide" lang="ne-Latn">${number.roman}</small></span>`).join('')}</div><div class="number-actions"><button class="quiet" data-number-action="again">Review again</button><button class="primary" data-number-action="explore">Explore the market ↗</button></div>`;
    }
    this.body.innerHTML = content;
    this.status.textContent = message;
    this.host.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }
  private click = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!button || !this.host.contains(button) || button.disabled) return;
    const action = button.dataset.numberAction;
    if (action === 'close') { this.onClose(); return; }
    if (action === 'explore' && this.stage === 'done') { this.onComplete(); return; }
    if (this.stage === 'learn') {
      if (button.dataset.numberIndex !== undefined) this.index = Number(button.dataset.numberIndex);
      else if (action === 'next') this.index = Math.min(4, this.index + 1);
      else if (action === 'previous') this.index = Math.max(0, this.index - 1);
      else if (action === 'unseen') this.index = numbers.findIndex((_, i) => !this.visited.has(i));
      else if (action === 'practice' && this.visited.size === 5) { this.stage = 'check'; this.checkIndex = 0; this.solved = false; }
      this.visited.add(this.index); this.render(); return;
    }
    if (action === 'review' || action === 'again') {
      this.stage = 'learn'; this.index = 0; this.solved = false; this.render(); return;
    }
    if (this.stage === 'check') {
      if (button.dataset.numberAnswer && !this.solved) {
        const number = numbers[this.checkOrder[this.checkIndex] - 1];
        this.solved = Number(button.dataset.numberAnswer) === number.value;
        if (this.solved) this.render('#numbers-title', `That’s right. ${number.word} means ${number.value}.`);
        else this.status.textContent = `Not quite. ${number.word} means ${number.value}. Try that number.`;
      } else if (action === 'advance' && this.solved) {
        this.solved = false;
        if (this.checkIndex === 4) this.stage = 'done';
        else this.checkIndex++;
        this.render();
      }
      return;
    }
  };
  dispose() { this.host.removeEventListener('click', this.click); this.host.hidden = true; this.host.replaceChildren(); }
}
