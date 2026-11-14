# Wayword website and demo entry

Landing page and demo authentication UI remain separate from the game source in the repository’s root `src/`. Uses the supplied handoff tokens and original SVG artwork.

## Run

Install both apps’ dependencies once:

```sh
npm ci
cd website
npm ci
npm run dev
```

Open http://127.0.0.1:5174/. The landing page is `/`, log-in is `/auth/`, sign-up is `/auth/?mode=signup`, language selection is `/languages/`, and the playable game is `/game/`.

Before the dev server starts, `predev` builds the root game into the ignored `public/game/` folder. No second server is needed. If changing game source while the website server is running, run `npm run build:game` in `website/` and reload the game.

```sh
npm run build
npm run preview
```

Production builds include all three entry points. Deploy `dist/` with directory-index support. The generated game bundle is ignored and rebuilt automatically; game source stays in the root app.

## Demo sign-up and log-in

Both forms accept any valid email and a password of at least 8 characters. Sign-up also requires a name. For example, use `demo@example.com` and `adventure123` with any demo name.

Valid submission resets the form and opens `/languages/index.html`. The language picker shows native names and flags. Nepali opens `/map/index.html`, where The Little Shop launches `/game/index.html`; other languages are marked coming soon and cannot launch a lesson yet. This is demo entry, not authentication: no account, backend, credential storage, or credential transmission. The game is also directly accessible. Password reset remains an explanatory placeholder. Google Fonts only loads the UI font.

Real authentication can be integrated later without moving auth into the game source.

## Level map and progression

The map starts at The Little Shop, with a winding path disappearing into clouds. Complete the shop by collecting the packed bag and walking through the exit to save completion on this browser. The results screen links back to the map. The next marker unlocks after completion but remains unplayable and marked coming soon until another level is implemented. Clouded later markers stay locked.

Progression checks: from the repository root, run `node --experimental-strip-types --test website/tests/progression.test.ts`.
