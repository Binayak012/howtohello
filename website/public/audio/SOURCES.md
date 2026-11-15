# Audio sources

## `map-node-click.wav`

A 0.14-second wooden click derived from “Mbira, note #2” by Joseph Sardin:

- https://bigsoundbank.com/mbira-note-2-s2286.html

The source is CC0 1.0. Its initial wooden transient was trimmed, shortened,
level-balanced, and faded for use as chapter-node feedback.

## `trace-success.wav` and `trace-complete.wav`

Short celebration mixes made for the Basic tracing lesson from:

- “Bright Ascending Success Chime 71”:
  - https://sfxmint.com/sounds/feedback-success-71
  - Download: https://sfxmint.com/dl/feedback-success-71.mp3
- “Small Tada 04”:
  - https://sfxmint.com/sounds/tada-04
  - Download: https://sfxmint.com/dl/tada-04.mp3
- “Applause”:
  - https://sfxmint.com/sounds/growth-41f04b2be34295a1012ef2ff-retry
  - Download: https://sfxmint.com/dl/growth-41f04b2be34295a1012ef2ff-retry.mp3

SFXMint publishes all three source files under CC0 1.0. `trace-success.wav`
mixes the ascending success chime with a quiet, trimmed applause bed and lasts
1.60 seconds. `trace-complete.wav` uses the richer three-note tada with a
slightly fuller applause bed and lasts 1.80 seconds. Both mixes were
level-balanced and faded to keep the feedback gentle.

## Generated tracing sounds

The softly descending “try again” notes and filtered pencil-on-paper texture
are original Web Audio synthesis in `website/src/trace-celebration.ts`. They
use no downloaded recordings or third-party audio assets.

## Shop and market word pronunciations (`ne/*.wav`)

Mirrored from the game’s `public/assets/audio/ne/` clips for website packaging:
`namaste`, `agadi`, `baaya`, `daaya`, `pachhadi`, `dhanyabaad`, `hunchha`.
Synthesized with Piper’s Nepali `ne_NP-chitwan-medium` voice (MIT model; CC0
training data). See `../assets/audio/CREDITS.md` in the game tree for hashes
and full notes. English TTS was not used.
