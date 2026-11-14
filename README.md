# Wayword — A new neighborhood

The story has six chapters, unlocked in order:

1. **Your First Hello**: greetings (courtyard)
2. **Unpack Your Suitcase**: colors (your room)
3. **Counting with Lila**: numbers 1–5 (courtyard bench)
4. **Your First Letters**: trace five vowels (website `/unit` page)
5. **The Little Shop**: directions
6. **The Morning Market**: the finale, reviewing greetings, colors, numbers and directions together

New players begin in chapter one; letter tracing no longer gates the start. Each chapter's results screen leads straight into the next, using `levelHref`/`nextLevel` in `src/progression.ts`. Existing shop and market saves retain access to those chapters without inventing completion of the new lessons. Run `npm test` for all state, progression and tracing rules; `npm run test:website` also checks the map, tracing and navigation.

## Your First Hello — chapter one

Move into a golden courtyard, greet Asha, politely request your key, physically collect it and thank her. Biren presents two real suitcases: reject the red one and identify your blue one with the yellow sun tag. He carries it from the luggage cart and sets it down for you to pick up. Unlock the green door and carry your suitcase inside to complete the chapter. An optional neighbor encounter reuses the greeting: find Lila’s parcel and hand it back. You can keep exploring and help her after settling in.

The five phrases are नमस्ते (namaste, hello), कृपया (kripaya, please), धन्यवाद (dhanyawaad, thank you), हो (ho, yes, it is) and होइन (hoina, no, it isn’t). The last two are explicitly taught as answers to “Is this your suitcase?” rather than universal yes/no words. Politeness is practiced with the complete request कृपया साँचो दिनुहोस्। (“Please give me the key.”). Latin reading guides can be hidden with Aa. This chapter currently teaches written phrases.

Use WASD or the arrow keys to move, drag to look, and E/Space to interact with someone or something nearby. Touch controls offer the same actions. People and furniture block movement, interactions require proximity and facing, and movement pauses during conversations and transfers. Restart cancels pending animations and restores the courtyard. A map fallback supports keyboard and touch when WebGL is unavailable. State rules, the 3D courtyard and the controller live in `src/arrival-state.ts`, `src/arrival-scene.ts` and `src/moving-in.ts` respectively; `src/main.ts` routes chapters.

The phrases and request construction were checked against [Introduction to the Nepali Language](https://pressbooks.bccampus.ca/nepali/chapter/chapter-2-unit-3-conversations/) and its [identification grammar](https://pressbooks.bccampus.ca/nepali/chapter/chapter-3-unit-4-grammar-focus/). Native-speaker review of the complete experience is still pending.

Carrying your suitcase through the door walks you into your new room; the results screen then offers chapter two.

## Unpack Your Suitcase — chapter two

Set in the room you just moved into. Explore five color cards: रातो (raato, red), निलो (nilo, blue), पहेँलो (pahelo, yellow), हरियो (hariyo, green) and सेतो (seto, white). Asha then names a color in Nepali only and you put away the matching item from the open suitcase on the bed, by tapping it in the room or using the buttons below (which also work without WebGL). Each item moves to the shelf or a hook. A three-question check asks the color of things around the room. A wrong pick explains which color you chose. Completion saves the chapter and opens Counting with Lila. Rules live in `src/unpack-state.ts`; the screen is `src/unpacking.ts`, reusing the chapter one room from `src/arrival-scene.ts`. It opens at `?level=second-lesson` once chapter one is complete. Native-speaker review is pending.

## Counting with Lila — chapter three

Back in the courtyard, Lila stands behind the bench with five apples and a basket. Explore cards for एक, दुई, तीन, चार, पाँच (1–5) with Nepali digits and apple groups. Lila then asks for तीन, एक and चार apples. Tap apples on the bench to add them, tap one in the basket to take it out, or use the − / + buttons; then hand the basket over. A wrong count names what you gave. Two quick questions ask how many apples Lila put in the basket. Completion opens chapter four. Rules: `src/counting-state.ts`; screen: `src/counting.ts`; route `?level=counting`.

## Your First Letters — chapter four

On the hosted site's `/unit/` page: trace अ आ इ ई उ with the pencil guide, hear each recording, or use the keyboard alternative. It is locked until chapter three is complete, but stays usable if browser storage is blocked. Finishing saves `letters` and offers The Little Shop. In the standalone game (`npm run dev:game`) the route shows a note pointing to the full site.

## The Little Shop — chapter five

A local, first-person language lesson built from the Wayword handoff. The story follows your first errand in a new neighborhood: learn four Nepali directions, collect a reusable bag, two pieces of fruit and a bottle, bring them to checkout, pick up the packed shopping, and walk toward the closed door to finish. Choose Next level on the completion prompt to open the door and walk outside into the market preview.

The shop fills the browser viewport, with an optional full-screen button. First greet the shopkeeper with नमस्ते (namaste, hello); the shopkeeper responds with a greeting gesture. An interactive word map then teaches दायाँ (daaya, right), बायाँ (baaya, left), अगाडि (agadi, forward/ahead), and पछाडि (pachhadi, backward/behind). Four guided actions let the learner try each meaning in the shop. Backward steps preserve the player’s facing.

Latin-letter guides are on by default in the word cards and every gameplay cue, so reading Devanagari is not a prerequisite. The Aa button lets script readers hide or restore those guides throughout the playthrough. The guides are approximate transliterations, not a replacement for native pronunciation audio or a separate script curriculum.

During shopping, left and right refer to the sides of the shop as seen from its entrance. Floating cues guide the route to checkout and the exit. The contextual Space action changes from Take to Place items to Pick up bag. The shopkeeper scans the four individual items and packs the bag. Results appear after the learner collects the packed bag and reaches the door inside the shop, facing it; collecting the items alone does not finish the lesson. Progress saves before leaving. The door stays closed until Next level is selected. Restart cancels scanning or the departure and restores stock.

The interior includes a checkout, chilled drinks, bread, pantry shelving, produce crates, reusable bags, and books. Stock uses individual product models: Take picks one unit from the shelf into your bag, with a visible hand animation and an inventory count. Clicking a specific item selects that unit; pressing Take selects a front-row item. Restart restores all shelf stock. The camera is at adult eye height, with a checkout footprint that keeps the player in front of the desk.

Exit guidance turns you toward the door and uses forward steps. After shop completion, Next level starts the departure: the opaque door swings open, sunlight catches your hand, and the camera steps onto a raised footpath before turning right. The wider market runs perpendicular to the shop, with footpaths on both sides. Varied adult and older shoppers exchange goods with vendors; a parent calms a stomping child, and a delivery bicycle passes along the road. Pink clouds, blue and coral sky, birds, pennants, dust and a sinking low sun fill the morning scene. Continue skips the nine-second reveal; reduced-motion preferences show the arrival immediately. Arrival offers the number lesson. Restart cancels the walk or lesson and restores the shop. Street geometry and animation live in `src/market.ts`.

## The Morning Market — chapter six, the finale

The finale reviews the four spoken topics together. It opens on a review card (greetings, colors, numbers, directions) and goes straight into free roaming; numbers are taught in chapter three, and **Review numbers 1–5** remains available while exploring. Use WASD to move, arrow keys to turn, drag the scene to look (including down at objects), and E/Space to interact nearby. Touch controls and action buttons provide the same movement and actions. Furniture and people block movement; other shoppers step aside when you approach a vendor.

Visit neighbors in any order. Greet each with नमस्ते, then perform activities in the world: pick two रातो (red) apples into your basket; pay three one-rupee coins for a loaf and receive it from the baker; gather four पहेँलो (yellow) flowers from the left vase, not the सेतो (white) ones on the right; or follow right/behind direction clues to find a lost रातो teddy behind a planter and carry it back to the child. The child’s task uses directions, not counting. Wrong quantities can be corrected by putting items or coins back. Vendors turn, greet, gesture, fetch goods and exchange items. The parent points toward the toy; the child stops crying, smiles, and holds the returned teddy. Transactions and pick-ups animate in 3D; reduced motion uses immediate object changes and held gesture poses.

Finishing the three stall exchanges saves the market finale; the toy rescue is optional. Exploration remains open afterward. Starting exploration and completed visits are remembered, so returning learners resume free roaming directly. Reviewing numbers pauses movement and preserves the current task. The Aa control applies throughout; audio is not yet included. The map unlocks this chapter after The Little Shop and resumes it at `/game/index.html?level=market`. A fresh learner visiting a locked chapter sees a return to chapter one. Lesson logic lives in `src/numbers.ts`; roaming and physical interactions live in `src/market-play.ts`, with collision and activity data in `src/market-world.ts`. Vocabulary was cross-checked against [Introduction to the Nepali Language, Numerals](https://pressbooks.bccampus.ca/nepali/chapter/chapter-1-unit-9-numerals/); native-speaker review of the complete learning experience remains pending.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5174/ for the complete experience: home → sign-up/log-in → languages → map → game. The root `dev`, `build`, and `preview` commands run this complete site. `npm run build` writes the deployable site, including the game, into `website/dist/`. The game’s Wayword logo returns to home; its results screen has a separate return-to-map link.

For isolated game development with live reload, use `npm run dev:game`. To build only the game, use `npm run build:game`. These isolated entry points do not include the website’s home or auth pages. The complete site's dev server rebuilds its game bundle at startup; after editing game source, restart it or run `npm --prefix website run build:game` and reload.

Use left/right arrows to turn, up/down to step forward/backward, and Space to take an item, place shopping on the counter, or collect the packed bag. Every action also has an on-screen button. The ? button gives the next navigation step.

## Verify

```sh
npm run build
npm test
npm run test:browser
npm run test:website
```

Browser tests use installed Google Chrome. They cover moving in on desktop and phone, incorrect answers and recovery, the optional parcel exchange, key/suitcase collection, door entry, completion saving, animation cancellation on restart, and the courtyard fallback without WebGL. Shop and market checks cover directions, shopping, checkout, departure, learning numbers, free roaming, physical transactions and the toy rescue. Website checks cover navigation, chapter order, locked routes and retained legacy saves. Core tests check lesson sequencing, interaction reachability, collision, stock, movement and progression.

## Prototype limits

- The supplied Nepali translations await native-speaker review.
- The shop includes positional radio music and action sound effects, with an on/off radio control. Basic includes vowel pronunciation recordings; spoken story dialogue is not yet included. Shop movement cues add English hints after the second miss; courtyard and market conversations include English teaching text.
- Results last for the current playthrough and distinguish first-try successes from actions practiced with help.
- WebGL renders the shop and shopkeeper. A keyboard-accessible map replaces the scene when WebGL is unavailable.
- Nothing is published; this project runs locally.

Design tokens live in `src/tokens.css` and `src/tokens.json`; cue strings live in `src/pack.ts`, movement and review rules in `src/core.ts`, and the 3D shop in `src/scene.ts`.

## Landing and authentication website

The landing page and UI-only authentication screens live in [`website/`](website/README.md). Run `npm run dev` from the repository root to serve them together with the game on port 5174. Game source remains in the root `src/` directory. Website navigation tests cover home, auth, language selection, the map, game entry, home return, direct URLs and browser history; build the site before running `npm run test:website`.
