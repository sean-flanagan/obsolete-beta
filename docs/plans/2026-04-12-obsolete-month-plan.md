# Obsolete April Upgrade Plan

> For Hermes: use this as the implementation checklist for the next polish and content pass.

Goal: turn Obsolete from a strong 3-level jam prototype into a more competitive 13-level browser game with clearer interaction, denser atmosphere, and better first-impression polish.

Architecture:
- Keep the current split between content in `src/levels.js`, game logic in `src/game.js`, rendering in `src/renderer.js`, and HUD wiring in `src/main.js`.
- Extend existing systems instead of rewriting them: interaction focus, palette-driven lighting, dust/spark FX, and act loading already exist and should become reusable level-scale systems.
- Expand from 3 large acts to 13 authored levels grouped into 4 chapters, while preserving the current emotional arc.

Tech stack: Three.js, Vite, vanilla JS, HTML/CSS HUD, current renderer/game architecture.

---

## Current state snapshot

Current content structure:
- `src/levels.js` defines 3 entries in `ACTS`
- Current arc:
  1. `boot-sequence`
  2. `scrap-escape`
  3. `prove-you-still-work`

Current strengths already in code:
- `src/renderer.js`
  - hemisphere + directional + rim + hero lighting
  - fog and palette swapping
  - interaction ring
  - glow planes, dust, sparks, checkpoint pulse, conveyor stripe animation
- `src/game.js`
  - interaction focus labels already exist
  - objective system already exists
  - checkpoints, conveyors, hazards, cutscenes, minigame already exist
- `src/main.js`
  - interaction prompt and HUD bindings already exist

Main opportunity:
- improve clarity and “wow” by extending current systems, not replacing them

---

## Top 5 concrete code changes this week

### 1. Upgrade interaction readability

Objective: make interactables impossible to miss and easier for judges to understand instantly.

Files:
- Modify: `src/game.js`
- Modify: `src/renderer.js`
- Optional style tweak: `styles.css`

Changes:
- Keep `interactionFocus`, but add richer metadata:
  - `label`
  - `tone` (`talk`, `power`, `danger`, `exit`)
  - `highlightStyle` (`ring`, `pulse`, `beacon`)
- In `src/renderer.js`, upgrade `createInteractionRing()` into a small focus package:
  - main ring
  - vertical beacon sprite/plane
  - optional pulsing glow
- In `updateDynamicObjects(game)`, style the interaction marker based on `game.interactionFocus.type`
- Keep the prompt text from `updateUi()` but shorten the wording to action-first phrases

Exact places to start:
- `src/game.js:234-273` (`getInteractionFocus()`)
- `src/game.js:1038-1053` (`updateUi()`)
- `src/renderer.js:1070-1082` (`createInteractionRing()`)
- `src/renderer.js:512-526` (focus update branch)

Definition of done:
- NPCs, sockets, consoles, and exits each feel visually distinct when focused
- prompt text is shorter and stronger
- a first-time player can tell what to do without reading the bottom panels

---

### 2. Replace or supplement ambient spheres with billboard particles

Objective: make the yard feel more alive with cheaper, denser atmosphere.

Files:
- Modify: `src/renderer.js`

Changes:
- Keep the current dust/spark logic as fallback, but add a billboard particle layer for:
  - dust haze
  - floating CRT motes
  - warm dawn flecks
- Use `THREE.Sprite` or `THREE.Points` with a tiny generated circular texture
- Add at least two depth layers:
  - far haze layer
  - near accent layer
- Tie opacity/intensity to mode (`title`, `boot`, `play`, `ending`)

Exact places to start:
- `src/renderer.js:84-164` (`setupAtmosphere()`)
- `src/renderer.js:445-466` (dust/spark update block)

Definition of done:
- title screen and gameplay scene feel denser without obvious framerate drop
- atmosphere reads better in screenshots
- particle count and opacity are easy to tune via constants near the top of `renderer.js`

---

### 3. Add a lightweight clutter scatter system

Objective: make each level feel richer without hand-placing every tiny scrap prop.

Files:
- Modify: `src/renderer.js`
- Modify: `src/levels.js`

Changes:
- Add a new decor type for repeated scatter zones, e.g.:
  - `scatter_scrap`
  - `scatter_glass`
  - `scatter_cables`
- Start simple: no `InstancedMesh` yet unless needed; use grouped reused primitive meshes first, then optimize if counts rise
- Create one helper in `renderer.js` that builds small randomized clusters inside a rectangular area
- Use it only in a few high-value zones first:
  - around the opening heap
  - beside conveyor lanes
  - near checkpoint recovery spots

Exact places to start:
- `src/renderer.js:707-767` (`createDecorMesh()`)
- `src/levels.js` `decor` arrays in all current acts

Definition of done:
- each current level gets 2-4 richer clutter zones
- world feels less empty even before adding new mechanics
- scatter data is authored in `levels.js`, not hardcoded in render update loops

---

### 4. Improve title-screen and boot spectacle

Objective: win the first 10 seconds.

Files:
- Modify: `src/game.js`
- Modify: `src/renderer.js`
- Modify: `index.html`
- Modify: `styles.css`

Changes:
- Keep the current title structure, but reduce competing text on first load
- Add one stronger “boot up” payoff using existing systems:
  - sharper screen glow pulse
  - stronger power LED flicker
  - brief camera settle or push-in
  - one stronger floor glow expansion
  - more distinct spark burst on boot completion
- Make the title objective more mechanical and concise

Recommended copy direction:
- current emotional premise stays
- add one compact loop line near the start button, e.g.
  - `Recover power. Escape the scrap line. Prove you still work.`

Exact places to start:
- `src/game.js:91-115` (`reset()`)
- `src/game.js:362-377` (`updateBoot()`)
- `src/renderer.js:414-466` (title/boot atmosphere timing)
- title/HUD markup in `index.html`

Definition of done:
- title screen is cleaner
- boot sequence feels like an event, not only a wait state
- first-time players understand both the premise and the loop faster

---

### 5. Expand from 3 acts to a 13-level structure

Objective: scale content cleanly without breaking the existing systems.

Files:
- Modify: `src/levels.js`
- Modify: `src/game.js`
- Modify: `README.md`
- Optional: `progress.md`

Recommended structure:
- Convert the game from 3 giant acts into 13 short levels grouped into 4 chapters

Proposed level list:
- Chapter 1: Wake
  1. Cold Boot
  2. Heap Talk
  3. Socket Run
- Chapter 2: The Line
  4. Belt Ride
  5. Crusher Alley
  6. Floppy Hunt
  7. Gate Feed
- Chapter 3: Deep Yard
  8. Fence Maze
  9. Battery Garden
  10. Modem Relay
- Chapter 4: Proof
  11. Diagnostic Hall
  12. POST Trial
  13. Dawn Escape

Implementation approach:
- Preserve the current emotional beats and split them into shorter authored levels
- Add chapter/level metadata to each level entry:
  - `chapter`
  - `number`
  - `label`
  - `title`
  - `hint`
- Replace the current `ACTS` meaning with `LEVELS`, or keep the export name but treat entries as levels
- Add progression flags in `game.js` for chapter transitions only where necessary
- Keep current special systems scoped to a few levels:
  - conveyors only where needed
  - crusher logic reused in 2-3 levels
  - final diagnostic minigame only in the last chapter

Exact places to start:
- `src/levels.js:138-394` (current `ACTS` array)
- `src/game.js:117-130` (`loadAct()`)
- `src/game.js:183-231` (`getCurrentObjective()` currently hardcodes act indexes)
- anywhere `this.actIndex === 0/1/2` appears in `src/game.js`

Critical refactor note:
- Before adding all 13 levels, remove hardcoded act-index assumptions and replace them with level IDs or capability checks
- Example: instead of `this.actIndex === 1`, prefer checks like:
  - `this.act.gateConsole`
  - `this.act.console`
  - `this.act.chapter === 2`
  - `this.act.id === "gate-feed"`

Definition of done:
- level flow supports 13 authored entries
- objective logic no longer relies on only 3 fixed indices
- each level can be shorter, clearer, and more screenshot-friendly

---

## Recommended rollout order

### Phase 1: readability + atmosphere
1. interaction readability upgrade
2. billboard particle layer
3. title/boot polish

### Phase 2: denser staging
4. clutter scatter system
5. apply scatter + atmosphere tuning to all current levels

### Phase 3: content scale-up
6. refactor `ACTS` assumptions in `game.js`
7. split current 3 acts into the first 7 levels
8. add levels 8-13 with reused systems and new layouts
9. tune pacing, copy, and checkpoints

---

## Concrete code audit checklist for the 13-level refactor

In `src/game.js`, inspect and update all logic that assumes exactly 3 acts:
- `loadAct(index)`
- `getCurrentObjective()`
- `getInteractionFocus()`
- `checkActInteractions()`
- any `this.actIndex === ...` branches
- any direct assumptions about battery/floppy/diagnostic only existing once

Refactor strategy:
- prefer data-driven level capabilities stored in `levels.js`
- each level should declare only the systems it uses
- game logic should ask “does this level have X?” rather than “am I in act 2?”

---

## Proposed 13-level content reuse map

To keep scope realistic, reuse systems like this:

Core reusable systems:
- talk-to-NPC objective
- push battery / carry power object
- conveyor force lane
- crusher hazard
- checkpoint zones
- collectible fragment
- console interaction
- gate unlock
- final memory minigame

Suggested distribution:
- Levels 1-3: movement, talking, battery/socket
- Levels 4-7: conveyor, crushers, floppy/gate flow
- Levels 8-10: remix existing hazards + more navigation/escort/relay beats
- Levels 11-13: console, diagnostic, finale

This prevents the 13-level goal from becoming 13 entirely new mechanic sets.

---

## Practical success criteria for the month

By the end of the month, Obsolete should have:
- a stronger first 10 seconds
- much clearer interactables
- richer atmosphere on the same renderer budget
- denser and more intentional junkyard dressing
- a playable 13-level progression with short, memorable stages

---

## Suggested immediate next implementation task

Start with Task 1: interaction readability.

Why first:
- fastest visible improvement
- helps every current and future level
- low risk
- directly improves judge experience
