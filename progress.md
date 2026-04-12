Original prompt: Build a small, polished, web-playable game called "Obsolete" with a complete jam-scale loop, three playable sections, lightweight browser tech, atmosphere, clean source structure, and a README.

Progress log:
- Replaced the old non-matching prototype with a new static Canvas game structure tailored to "Obsolete".
- Added modular source files for level data, audio synthesis, main bootstrapping, and the main game loop.
- Implemented title screen, BIOS-style boot sequence, Act 1 battery puzzle, Act 2 conveyor/crusher/floppy escape, Act 3 diagnostic mini-game, ending, and restart flow.
- Added deterministic hooks: `window.render_game_to_text` and `window.advanceTime(ms)`.
- Fixed the Act 1 battery collision so the puzzle is actually pushable instead of acting like a dead blocker.
- Fixed the final mini-game input mapping so keyboard directions match the expected sequence logic.
- Verified the build in a local browser session with no captured console/page errors, then removed the temporary verification artifacts and npm install used for testing.
- Converted the presentation layer from Canvas 2D to a small Three.js diorama renderer while preserving the same three-act game flow.
- Reworked the shell into a Three.js scene mount plus HTML overlays for title, BIOS boot text, dialogue, battery meter, mini-game prompts, and win state.
- Added Vite scripts and verified the new Three.js build compiles successfully.
- Browser-smoked the Three.js version: the scene renders, the overlays update, and the game reaches Act 1 with no captured console/page errors.
- Added a lightweight reusable cutscene system with timed dialogue, banners, camera focus points, and skip/advance support.
- Hooked in short cutscenes for the wake-up, battery gate reveal, scrap line intro, final-test intro, and post-diagnostic gate unlock.
- Inspected the Vibe Jam starter pack's `toonshooter` and `forest-census` Three.js examples.
- Reused the static `public/` asset-manifest idea and imported a few `toonshooter` GLTF props into `Obsolete` for stronger junkyard dressing.
- Wired those starter-pack props into the renderer as optional GLTF-backed decor upgrades with primitive fallbacks.

TODO / verification:
- Manual tuning ideas if time remains: make memory fragments easier to spot in 3D, adjust camera framing in Act 1 if the battery feels too far from the player, and add a tiny end-card beat after the win screen if desired.
