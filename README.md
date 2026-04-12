# Obsolete

Obsolete is a small web-playable Three.js game jam prototype about a sentient 90s laptop escaping an e-waste junkyard before dawn. It is designed to feel complete but realistically scoped: a beginning, middle, end, one memorable loop, lightweight procedural audio, and no large downloads.

## Tech Stack

- Three.js
- Vite
- Modular vanilla JavaScript
- HTML/CSS overlays for HUD, dialogue, mini-game prompts, and title/win screens
- Web Audio API for generated sound effects

## Folder Structure

```text
.
├── index.html
├── styles.css
├── package.json
├── README.md
├── progress.md
└── src
    ├── audio.js
    ├── game.js
    ├── levels.js
    ├── main.js
    └── renderer.js
```

## Game Structure

1. Boot Sequence
   The laptop wakes in the scrap heap, meets discarded electronics, and powers an exit gate by pushing a battery into a socket.
2. Scrap Escape
   The player crosses a junk-processing lane with conveyors, moving crusher hazards, checkpoints, and a floppy-disk key item.
3. Prove You Still Work
   A short retro diagnostic mini-game opens the final route, followed by an escape ending and restart flow.

## Controls

- `WASD` or Arrow Keys: move
- `E` or `Space`: interact
- `Enter`: start from the title screen or confirm restart
- `R`: restart the prototype
- `F`: toggle fullscreen

## Run Locally

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Then open the local URL Vite prints in the terminal.

## Production Build

Create a deployable build:

```bash
npm run build
```

Preview the built version locally:

```bash
npm run preview
```

## Deployment

The production output is generated into `dist/`. Deploy that folder to any static host, such as:

- Netlify
- Vercel static hosting
- GitHub Pages
- itch.io HTML game upload

## Tuning Notes

- Level layouts, dialogue, and puzzle objects live in `src/levels.js`.
- Cutscene scripts also live in `src/levels.js` under `CUTSCENES`.
- Core game state, collisions, transitions, and the mini-game live in `src/game.js`.
- The low-poly Three.js presentation lives in `src/renderer.js`.
- Lightweight procedural sound lives in `src/audio.js`.
- `public/obsolete-assets.json` is a small manifest for imported starter-pack GLTF props.
- `public/assets/starter-pack/` contains the currently reused environmental models.

## Cutscenes

The project now includes a lightweight cutscene system:

- Each cutscene is a small array of timed steps in `src/levels.js`
- Steps can set dialogue, a banner, a camera focus point, and a temporary objective hint
- `src/game.js` plays those steps in a dedicated `cutscene` mode
- Players can advance cutscenes with `Enter`, `E`, or `Space`

Current built-in cutscenes:

- Act 1 wake-up conversation
- Battery/gate power-up beat
- Scrap Escape intro beat
- Final diagnostic intro beat
- Utility-confirmed beat before the final exit

## Starter Pack Reuse

I inspected two Three.js starters from the Vibe Jam pack:

- `toonshooter`: best source for reusable low-poly scrap/environment GLTF assets
- `forest-census`: best source for the simple static `public/` + asset-manifest pattern

What is currently reused in this project:

- Imported GLTF props from the starter pack for extra junkyard detail
- A small manifest-driven `public/` asset pattern inspired by the static starters

Current imported props:

- cardboard boxes
- pipes
- trash container
- long fence

## Jam Fit

- New project built for the jam prompt
- Web playable
- No login
- Free
- Single-player
- Fast startup
- AI-generated code as the main implementation
