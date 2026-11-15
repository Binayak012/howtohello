# Wayword website and demo entry

Landing page and demo authentication UI live here; game source lives in the repository’s root `src/`. Both are served together on the same origin. Uses the supplied handoff tokens and original SVG artwork.

## Run

From the repository root:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5174/. The landing page is `/`, log-in is `/auth/`, sign-up is `/auth/?mode=signup`, language selection is `/languages/`, the writing side quest is `/unit/`, and the playable game is `/game/`.

Before the dev server starts, `predev` builds the root game into the ignored `public/game/` folder. No second server is needed. If changing game source while the website server is running, run `npm run build:game` in `website/` and reload the game.

```sh
npm run build
npm run preview
```

The root commands delegate to this app; they also work from `website/`. Production builds include home, auth, languages, map and the game. Deploy `website/dist/` (or `dist/` relative to this directory) with directory-index support. The generated game bundle is ignored and rebuilt automatically; game source stays in the root app. Use `npm run dev:game` from the repository root only when you want the isolated shop without the website pages.

## Demo sign-up and log-in

Both forms accept any valid email and a password of at least 8 characters. Sign-up also requires a name. For example, use `demo@example.com` and `adventure123` with any demo name.

Valid submission resets the form and opens `/languages/index.html`. The language picker shows native names and flags. Nepali opens `/map/index.html`, where Your First Hello launches `/game/index.html?level=moving-in`; other languages are marked coming soon and cannot launch a lesson yet. This is demo entry, not authentication: no account, backend, credential storage, or credential transmission. The game is also directly accessible. Password reset remains an explanatory placeholder. Google Fonts only loads the UI font.

Real authentication can be integrated later without moving auth into the game source.

## Level map and progression

The four-chapter map starts at Your First Hello: meet your host, request a key, identify and carry your suitcase home, and optionally help a neighbor. Completion saves on this browser. Chapter two is reserved for the next lesson and cannot be launched or falsely completed. The Little Shop is chapter three; The Morning Market is the finale. New players progress in that order; existing shop and market saves retain access without fabricated new completions.

Complete the shop by collecting the packed bag and approaching the closed door. Next level opens the door and walks into the market. The finale teaches Nepali numbers 1–5, then allows free roaming, greetings, directions, physical shopping and payment with coins. An optional lost-toy rescue reuses directions. `/game/index.html?level=market` resumes that chapter when unlocked; the number introduction is skipped once learned. Completing the three stall exchanges saves the finale while leaving exploration open. Locked direct chapter URLs offer a return to the first lesson.

Progression checks: from the repository root, run `node --experimental-strip-types --test website/tests/progression.test.ts`.

## Writing practice side quest

The map links to writing practice at `/unit/index.html`. Lessons 1–4 do not require tracing. Practice any of अ आ इ ई उ with the pencil tutorial; each accepted trace is saved independently and users resume the first unfinished letter. Completion of all five is the prerequisite for future Lesson 5. Set 2 (ऊ ए ऐ ओ औ) is required before future Lesson 9. Extra practice covers अं अः ऋ ॠ, without adding another lesson gate. The teaching sequence follows the owner’s supplied chart. All 14 vowels have guided paths; only the original five have recorded pronunciation, with the remaining speakers marked as awaiting recordings. These rules live in `src/tracing-progress.ts` and are checked by the map and direct game entry. Old door unlocks and demo skips do not count as writing progress. Typed practice remains available but does not record a trace.

Successful entry opens the door and saves the unlock on this browser (with session-storage fallback). Basic introduces the existing four-chapter story: Your First Hello, the reserved second lesson, The Little Shop, and The Morning Market finale. Writing practice is separate from chapter two. Fresh direct entry to the hosted game returns to Basic until unlocked; existing chapter saves retain access. The root standalone game remains independently runnable. The merged build scripts call `build:game` directly to avoid recursively invoking the complete website build.

Letter-order reference: https://pressbooks.bccampus.ca/nepali/chapter/chapter-1-unit-2-vowel-letters/

Tests: `node --experimental-strip-types --test website/tests/*.test.ts` from the repository root.

## Writing tutorial

Writing practice first opens a short tutorial explaining the gold starting dot, holding the pointer to draw, and lifting between strokes. Each letter offers a full animated demonstration and numbered stroke replays. The animation uses the same teal-and-gold pencil SVG as login (`src/pencil.ts`). Reduced-motion users get static steps. Replay keeps existing user ink; demo ink never enters validation.

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

## Map music

The map has an original, low-volume, 32-beat menu loop (a nostalgic music-box melody, warm retro chords, gently swaying arpeggios, and short stereo reverb at 68 BPM), generated locally with Web Audio. The floating music button remembers the on/off choice separately from transition sound. Browser autoplay rules may require a click to begin; the button then reads Play music. Playback suspends while the tab is hidden and fades/stops when leaving the map. No external music requests are made.

## Temporary hackathon skip

The tracing screen and tutorial include **Skip for demo**, which now returns to the map without recording any traces or bypassing future writing prerequisites. Set `VITE_DEMO_SKIP_TRACING=false` to hide this temporary control.

Tracing uses `public/audio/pencil-strokes-continuous.wav`, edited from the owner-provided MP3 by removing the five long silent gaps and applying 12ms joins. The unedited MP3 is kept alongside it. Playback stays at its natural pace, playing only while the pencil moves and pausing between strokes. The Effects toggle remembers the user's choice and pauses tracing/celebration effects; pronunciation remains separately available. The original Downloads recording is unchanged.
