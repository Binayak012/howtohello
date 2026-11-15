import { completeLevel, journey, levelHref, type LevelId } from './progression';

/** Set to false to remove the demo chapter skipper everywhere. */
export const DEMO_SKIP = true;

const css = `
.demo-skip{position:fixed;left:6px;bottom:6px;z-index:9999;font:600 11px/1.3 system-ui,sans-serif;color:#2b2340}
.demo-skip>button{width:26px;height:26px;border-radius:50%;border:1px solid #d9cdb5;background:#fffaf0;opacity:.6;cursor:pointer;font-size:12px;box-shadow:0 2px 6px #2b234020;padding:0}
.demo-skip>button:hover,.demo-skip>button:focus-visible,.demo-skip[data-open=true]>button{opacity:1}
.demo-skip nav{position:absolute;left:0;bottom:32px;width:220px;padding:8px;border-radius:14px;background:#fffaf0;border:1px solid #e6dcc6;box-shadow:0 12px 36px #2b234035}
.demo-skip nav p{margin:2px 6px 6px;font-size:9px;letter-spacing:.12em;color:#7a6f86}
.demo-skip nav a{display:flex;gap:8px;padding:7px 8px;border-radius:9px;color:inherit;text-decoration:none}
.demo-skip nav a:hover,.demo-skip nav a:focus-visible{background:#efe6d3;outline:none}
.demo-skip nav a[aria-current=page]{background:#1f7a7a;color:white}
.demo-skip nav b{min-width:18px;opacity:.7}
`;

/** Mark exactly the chapters before `id` as done and clear finale state, so the chosen chapter opens fresh. */
export function prepareChapter(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, id: LevelId) {
  storage.setItem('wayword.progress.ne.v1', '[]');
  for (const level of journey) { if (level.id === id) break; completeLevel(storage, level.id); }
  for (const key of ['wayword.market-visits.ne.v1', 'wayword.wallet.ne.v1', 'wayword.numbers.ne.v1']) storage.removeItem(key);
}

/** A small corner button for demos: jump straight to any chapter. */
export function mountDemoSkip(website: boolean, current?: LevelId) {
  if (!DEMO_SKIP || document.querySelector('.demo-skip')) return;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  const root = document.createElement('div'); root.className = 'demo-skip'; root.dataset.open = 'false';
  root.innerHTML = `<button type="button" aria-label="Skip to a chapter (demo)" aria-expanded="false" title="Skip to a chapter (demo)">⏭</button><nav aria-label="Demo chapter skip" hidden><p>DEMO · SKIP TO</p>${journey.map(level => `<a href="${levelHref(level, website)}" data-skip="${level.id}"${level.id === current ? ' aria-current="page"' : ''}><b>${String(level.chapter).padStart(2, '0')}</b>${level.title}</a>`).join('')}</nav>`;
  document.body.append(root);
  const toggle = root.querySelector('button')!, menu = root.querySelector('nav')!;
  const setOpen = (open: boolean) => { menu.hidden = !open; root.dataset.open = String(open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', event => { event.stopPropagation(); setOpen(menu.hidden === true); if (!menu.hidden) menu.querySelector('a')?.focus(); });
  menu.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-skip]');
    if (!link) return;
    event.preventDefault();
    try { prepareChapter(localStorage, link.dataset.skip as LevelId); } catch { /* Without storage, the link still opens unlocked chapters. */ }
    location.href = link.href;
  });
  // Keep game keyboard controls from reacting while the menu is in use.
  root.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { setOpen(false); toggle.focus(); } });
  document.addEventListener('click', event => { if (!root.contains(event.target as Node)) setOpen(false); });
}
