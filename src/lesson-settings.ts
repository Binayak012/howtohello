import './lesson-settings.css';

/** Move each lesson's existing controls together without replacing their handlers. */
export function mountLessonSettings(scope: HTMLElement): () => void {
  const controls: [string, string][] = [
    ['#nepali-script', 'Nepali script'],
    ['#reading-help, #arrival-reading', 'Latin-letter guides'],
    ['#radio-toggle', 'Shop radio'],
    ['#tap-sounds', 'Tap sounds'],
    ['.trace-effects-toggle', 'Tracing effects'],
    ['#fullscreen', 'Full screen'],
  ];
  const collect = () => {
    const header = scope.querySelector<HTMLElement>('.arrival-header, .masthead, .unit-nav');
    if (!header) return;
    let menu = header.querySelector<HTMLDetailsElement>('.lesson-settings');
    if (!menu) {
      menu = document.createElement('details');
      menu.className = 'lesson-settings';
      menu.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          menu!.open = false;
          menu!.querySelector('summary')?.focus();
        }
      });
      menu.innerHTML = '<summary aria-label="Lesson settings" title="Lesson settings"><span aria-hidden="true">⚙</span></summary><div class="lesson-settings-panel" role="group" aria-label="Lesson settings"><p>Lesson settings</p></div>';
      (header.querySelector('.arrival-header-actions, .header-actions') ?? header).append(menu);
    }
    const panel = menu.querySelector('.lesson-settings-panel')!;
    for (const [selector, label] of controls) {
      const button = scope.querySelector<HTMLButtonElement>(selector);
      if (!button || panel.contains(button)) continue;
      const row = document.createElement('div');
      row.className = 'lesson-settings-row';
      if (button.matches('#nepali-script, #reading-help, #arrival-reading')) button.classList.add('lesson-settings-switch');
      const caption = document.createElement('span');
      caption.textContent = label;
      row.append(caption, button);
      panel.append(row);
    }
  };
  const close = (event: Event) => {
    scope.querySelectorAll<HTMLDetailsElement>('.lesson-settings[open]').forEach(menu => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menu.contains(event.target as Node)) {
        menu.open = false;
        if (event instanceof KeyboardEvent) menu.querySelector('summary')?.focus();
      }
    });
  };
  collect();
  const observer = new MutationObserver(collect);
  observer.observe(scope, { childList: true, subtree: true });
  document.addEventListener('click', close);
  scope.addEventListener('keydown', close);
  return () => {
    observer.disconnect();
    document.removeEventListener('click', close);
    scope.removeEventListener('keydown', close);
    scope.querySelectorAll('.lesson-settings').forEach(menu => menu.remove());
  };
}
