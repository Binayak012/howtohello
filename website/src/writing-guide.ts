import { pencilSvg } from './pencil';
import { writingLessons } from './writing-strokes';

export function setupWritingGuide(board: HTMLElement, onMessage: (message: string) => void) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(svgNS, 'svg');
  overlay.setAttribute('viewBox', '0 0 280 240');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.classList.add('writing-guide-overlay');
  board.append(overlay);
  const controls = document.createElement('div');
  controls.className = 'writing-guide-controls';
  board.after(controls);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let letterIndex = 0;
  let frame = 0;
  let playing = false;
  let disposed = false;
  let strokeIndex = 0;
  let demonstrations: SVGPathElement[] = [];
  let pencil: SVGGElement;
  let marker: SVGGElement;
  const lesson = () => writingLessons[letterIndex];

  function cancel() { cancelAnimationFrame(frame); playing = false; }
  function markStart(index: number) {
    const [x, y] = lesson().strokes[index].start;
    marker.setAttribute('transform', `translate(${x} ${y})`);
    marker.querySelector('text')!.textContent = String(index + 1);
    const path = demonstrations[index];
    const start = path.getPointAtLength(0), ahead = path.getPointAtLength(Math.min(12, path.getTotalLength()));
    const angle = Math.atan2(ahead.y - start.y, ahead.x - start.x) * 180 / Math.PI;
    marker.querySelector('path')!.setAttribute('transform', `rotate(${angle})`);
    controls.querySelectorAll<HTMLButtonElement>('[data-stroke]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  }
  function putPencil(path: SVGPathElement, distance: number) {
    const point = path.getPointAtLength(distance);
    // Anchor the real pencil tip (8,61), rather than its top-left corner.
    pencil.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(-24) scale(.68) translate(-8 -61)`);
  }
  function prepare(index: number) {
    cancel(); letterIndex = index; strokeIndex = 0;
    overlay.innerHTML = `<g class="writing-demo-paths">${lesson().strokes.map(stroke => `<path d="${stroke.path}" fill="none" stroke="#1f7a7a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>`).join('')}</g><g class="writing-start-marker"><circle r="12" fill="#f4b63f" stroke="#fffcf6" stroke-width="2"/><text text-anchor="middle" dominant-baseline="central" fill="#2b2340" font-size="12" font-weight="700">1</text><path d="M16 0h16m-5-4 5 4-5 4" fill="none" stroke="#1f7a7a" stroke-width="2"/></g><g class="writing-pencil">${pencilSvg.replace('<svg ', '<svg width="16" height="64" ')}</g>`;
    demonstrations = [...overlay.querySelectorAll<SVGPathElement>('.writing-demo-paths path')];
    pencil = overlay.querySelector<SVGGElement>('.writing-pencil')!;
    marker = overlay.querySelector<SVGGElement>('.writing-start-marker')!;
    pencil.style.display = 'none';
    controls.innerHTML = `<button type="button" class="text-button" id="watch-writing">Watch pencil ↻</button><div class="writing-stroke-buttons" role="group" aria-label="Watch individual strokes">${lesson().strokes.map((_, i) => `<button type="button" data-stroke="${i}" aria-label="Show stroke ${i + 1}" aria-pressed="${i === 0}">${i + 1}</button>`).join('')}</div>`;
    controls.querySelector<HTMLButtonElement>('#watch-writing')!.onclick = () => {
      if (playing) { prepare(letterIndex); return; }
      play();
    };
    controls.querySelectorAll<HTMLButtonElement>('[data-stroke]').forEach(button => button.onclick = () => play(Number(button.dataset.stroke)));
    markStart(0);
    onMessage(`Start at the gold dot. ${lesson().strokes[0].instruction}`);
  }
  function play(onlyStroke?: number) {
    cancel();
    demonstrations.forEach(path => { path.setAttribute('opacity', '0'); path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; });
    marker.style.display = '';
    strokeIndex = onlyStroke ?? 0;
    markStart(strokeIndex);
    if (motion.matches) {
      demonstrations.forEach((path, i) => path.setAttribute('opacity', i <= strokeIndex ? '.7' : '0'));
      putPencil(demonstrations[strokeIndex], 0); pencil.style.display = '';
      onMessage(`Stroke ${strokeIndex + 1}: ${lesson().strokes[strokeIndex].instruction} Use the numbered buttons to see each step.`);
      return;
    }
    playing = true;
    controls.querySelector('#watch-writing')!.textContent = 'Your turn · Stop demo';
    pencil.style.display = '';
    const duration = 1150;
    const pause = 450;
    let started = performance.now();
    let announced = -1;
    function draw(now: number) {
      if (disposed) return;
      const path = demonstrations[strokeIndex];
      const length = path.getTotalLength();
      const progress = Math.min(1, (now - started) / duration);
      path.setAttribute('opacity', '1');
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length * (1 - progress));
      putPencil(path, length * progress);
      if (now - started >= duration + pause) {
        if (onlyStroke !== undefined || strokeIndex === lesson().strokes.length - 1) {
          cancel();
          controls.querySelector('#watch-writing')!.textContent = 'Watch pencil ↻';
          pencil.style.display = 'none';
          demonstrations.forEach(line => { line.setAttribute('opacity', '0'); line.style.strokeDasharray = ''; line.style.strokeDashoffset = ''; });
          markStart(onlyStroke ?? 0);
          onMessage(onlyStroke === undefined ? 'Your turn. Begin at dot 1, hold the mouse to draw, and lift between strokes. You can replay any step.' : `Your turn. Stroke ${onlyStroke + 1}: ${lesson().strokes[onlyStroke].instruction}`);
          return;
        }
        strokeIndex++; started = now; markStart(strokeIndex);
      }
      if (announced !== strokeIndex) {
        onMessage(`Stroke ${strokeIndex + 1} of ${lesson().strokes.length}: ${lesson().strokes[strokeIndex].instruction}`);
        announced = strokeIndex;
      }
      frame = requestAnimationFrame(draw);
    }
    onMessage(`Stroke ${strokeIndex + 1}: ${lesson().strokes[strokeIndex].instruction}`);
    frame = requestAnimationFrame(draw);
  }
  function startPractice() {
    cancel(); pencil.style.display = 'none'; marker.style.display = 'none';
    demonstrations.forEach(path => path.setAttribute('opacity', '0'));
  }
  function stopForMotionChange() { cancel(); prepare(letterIndex); }
  motion.addEventListener('change', stopForMotionChange);
  return {
    prepare,
    play,
    get playing() { return playing; },
    startPractice,
    reset() { prepare(letterIndex); },
    dispose() { disposed = true; cancel(); motion.removeEventListener('change', stopForMotionChange); overlay.remove(); controls.remove(); },
  };
}
