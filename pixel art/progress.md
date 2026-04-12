Original prompt: i wanna build a simple 2d top down action adventure game just one lil level with fun pixel art how would ya do it? / great go for it

## Progress
- Initialized Mosskey Shrine as a Phaser + Vite browser game prototype.
- Chose code-generated pixel art for the first playable version so the project runs without external art assets.

## TODO
- Implement core game loop, entities, level, HUD, and browser playtest hooks.
- Added the level data, generated pixel-art textures, player/enemy entities, input, combat, progression state, and main Phaser scene.
- Fixed Phaser ESM imports to use namespace imports for the installed Phaser build.
- Switched Phaser renderer from AUTO/WebGL to CANVAS after headless playtest produced a black canvas while game state was running.
- Simplified level layout so the player has a clear route from spawn to chest, gate, shrine courtyard, and relic.
- Fixed testing hook so it preserves the Playwright virtual-time advanceTime function instead of overriding it.
- Added Enter as an alternate interact key so browser automation and players can trigger chest/gate interactions more easily.
- Tightened relic win logic so the shrine seed only completes the level after the moss gate is opened.
- Replaced symbolic heart HUD text with ASCII HP text for simpler cross-environment rendering.
