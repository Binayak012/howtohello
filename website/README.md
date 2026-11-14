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

Open http://127.0.0.1:5175/. The landing page is `/`, log-in is `/auth/`, sign-up is `/auth/?mode=signup`, language selection is `/languages/`, and the playable game is `/game/`.

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

## Door-unlock experiment

This copy runs on port 5175 so it can run alongside the original Languigi site on port 5174. The map’s Basic unit opens `/unit/index.html`. Trace the first five Nepali vowels (अ आ इ ई उ) in order, checking each letter. Coverage and precision against the displayed glyph are checked locally; this is guided tracing, not freehand recognition. A keyboard alternative accepts the same sequence.

Successful entry opens the door and saves the unlock on this browser (with session-storage fallback). Basic contains five lesson slots: The Little Shop is playable; lessons 2–5 remain upcoming and sequentially locked. Direct entry to the hosted game returns to the door until Basic has been unlocked. The root standalone game remains independently runnable.

Letter-order reference: https://pressbooks.bccampus.ca/nepali/chapter/chapter-1-unit-2-vowel-letters/

Tests: `node --experimental-strip-types --test website/tests/*.test.ts` from the repository root.

## Writing tutorial

The door first opens a short tutorial explaining the gold starting dot, holding the pointer to draw, and lifting between strokes. Each letter offers a full animated demonstration and numbered stroke replays. The animation uses the same teal-and-gold pencil SVG as login (`src/pencil.ts`). Reduced-motion users get static steps. Replay keeps existing user ink; demo ink never enters validation.

Original simplified handwriting paths in `src/writing-strokes.ts` are shared by the canvas guide, demonstration, and checking target. The trace check now also requires coverage of each stroke, so omitting a short headline cannot pass just by covering the longer body. This is guided practice, not a handwriting-recognition or strict stroke-order assessment.

Writing-sequence references: [Central Hindi Directorate, Deskbook on Orthography of Devanagari Script (2019), vowel-writing unit](https://www.eoiparis.gov.in/content/Deskbook-on-Orthography-of-Devanagari-Script-2-_compressed_3.pdf); [short-vowel writing](https://www.ashtangayoga.info/philosophy/sanskrit-and-devanagari/devanagari/short-vowels/) and [long-vowel writing](https://www.ashtangayoga.info/philosophy/sanskrit-and-devanagari/devanagari/long-vowels/). These references teach Devanagari; the prototype does not attempt to teach pronunciation from Sanskrit/Hindi examples.

## Globe geography

The grid-free Earth uses bundled Natural Earth 1:110m land polygons, rounded to three decimals in `src/earth-land.ts`, projected with d3-geo’s orthographic projection for spherical horizon clipping. Land data is shipped with the app; the transition makes no external map-data requests. Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson. Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/ (public domain).

## Transition music and auth handoff

Login and sign-up open directly. The globe transition runs only from a valid demo auth submission to language selection. Both use an in-page history change with the destination rendered behind the final globe frame. Reduced-motion preferences bypass the transition.

`src/transition-tune.ts` synthesizes an original short music-box phrase using Web Audio, started from the initiating user gesture. No music downloads or external audio requests are made. A loading-screen mute toggle persists in browser storage. The phrase stops with a brief fade when the transition is disposed; unavailable or blocked audio does not prevent navigation. Actual audio playback should be checked in the user's browser.

The transition caption is timed to the globe camera: it appears during the opening hold and becomes fully hidden before the zoom close-up. The original music-box melody has been restored.

Auth has a short entrance on initial arrival, without replaying on mode switches. The guide closes his eyes when the password field (or its Show/Hide control) has focus and opens them when focus leaves that field. This reacts to focus only and does not inspect password contents.

The map entrance now plays on every map visit, including Continue learning: the trail reveals upward, unit icons pop in, and trees and flowers grow into place. Reduced-motion users see the map immediately, and entrance effects never block unit links.

## Letter pronunciation

The tracing heading has a speaker button and a short Latin-letter pronunciation guide. Playback now uses the user’s own recording, split into five WAV clips under `public/audio/ne/`. The user confirmed the sequence अ, आ, इ, ई, उ. The first five utterances were extracted with quiet margins and tiny edge fades; the additional final utterance was not used. The original M4A remains unchanged. `recording-source.json` records the source time ranges. Playback retains the previously requested 75% speed with pitch preservation.

No speech service or browser-installed voice is used for playback. Switching letters or leaving the tracing screen stops the audio. Earlier synthetic MP3s and their generation script remain as unused prototype assets; the active player references only the user’s WAV files.

Written hints are approximate. Reference: https://pressbooks.bccampus.ca/nepali/chapter/chapter-1-unit-2-vowel-letters/
