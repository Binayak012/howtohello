# Wayword — The little shop

A local, first-person language lesson built from the Wayword handoff. The story follows your first errand in a new neighborhood: learn four Nepali directions, collect a reusable bag, two pieces of fruit and a bottle, bring them to checkout, pick up the packed shopping, and walk outside to finish.

The shop fills the browser viewport, with an optional full-screen button. Before shopping, an interactive word map teaches दायाँ (daaya, right), बायाँ (baaya, left), अगाडि (agadi, forward/ahead), and पछाडि (pachhadi, backward/behind). Four guided actions let the learner try each meaning in the shop. Backward steps preserve the player’s facing.

Latin-letter guides are on by default in the word cards and every gameplay cue, so reading Devanagari is not a prerequisite. The Aa button lets script readers hide or restore those guides throughout the playthrough. The guides are approximate transliterations, not a replacement for native pronunciation audio or a separate script curriculum.

During shopping, left and right refer to the sides of the shop as seen from its entrance. Floating cues guide the route to checkout and the exit using all four directions. The contextual Space action changes from Take to Place items to Pick up bag. The shopkeeper scans the four individual items and packs the bag. Results appear only after the learner collects the packed bag and crosses the exit threshold; collecting the items alone does not finish the lesson. Restart cancels scanning and restores stock.

The interior includes a checkout, chilled drinks, bread, pantry shelving, produce crates, reusable bags, and books. Stock uses individual product models: Take picks one unit from the shelf into your bag, with a visible hand animation and an inventory count. Clicking a specific item selects that unit; pressing Take selects a front-row item. Restart restores all shelf stock. The camera is at adult eye height, with a checkout footprint that keeps the player in front of the desk.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use left/right arrows to turn, up/down to step forward/backward, and Space to take an item, place shopping on the counter, or collect the packed bag. Every action also has an on-screen button. The ? button gives the next navigation step.

## Verify

```sh
npm run build
npm test
npm run test:browser
```

Browser tests use installed Google Chrome. They cover the full story, word lesson, four practice movements, shopping, scanning, collecting the packed bag, and walking outside on desktop and phone. They also verify restart during scanning, individual-item removal, restocking, duplicate-pickup prevention, and checkout distance. Core tests check movement, collision, two-tile reach, counter and exit routes, locked-door behavior, backward movement, and individual stock selection and exhaustion.

## Prototype limits

- The supplied Nepali translations await native-speaker review.
- Sound is disabled. The lesson uses written Nepali cues; audio will be added later. English captions appear after the second miss.
- Results last for the current playthrough and distinguish first-try successes from actions practiced with help.
- WebGL renders the shop and shopkeeper. A keyboard-accessible map replaces the scene when WebGL is unavailable.
- Nothing is published; this project runs locally.

Design tokens live in `src/tokens.css` and `src/tokens.json`; cue strings live in `src/pack.ts`, movement and review rules in `src/core.ts`, and the 3D shop in `src/scene.ts`.

## Landing and authentication website

The independent landing page and UI-only authentication screens live in [`website/`](website/README.md). Run `cd website && npm ci && npm run dev` to develop them on port 5174. The game remains in the root app and runs separately.
