export const assetKeys = {
  tiles: {
    grass: 'tile-grass',
    tallGrass: 'tile-tall-grass',
    path: 'tile-path',
    stone: 'tile-stone',
    tree: 'tile-tree',
    rock: 'tile-rock',
    water: 'tile-water',
  },
  player: 'hero-scarf',
  slime: 'enemy-slime',
  goblin: 'enemy-goblin',
  chestClosed: 'chest-closed',
  chestOpen: 'chest-open',
  gate: 'moss-gate',
  relic: 'shrine-seed',
  slash: 'sword-slash',
  sparkle: 'sparkle',
};

function texture(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

function rect(g, color, x, y, w, h, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, w, h);
}

export function createPixelAssets(scene) {
  texture(scene, assetKeys.tiles.grass, 32, 32, (g) => {
    rect(g, 0x426e35, 0, 0, 32, 32);
    rect(g, 0x5f8f45, 3, 7, 3, 2);
    rect(g, 0x72a24e, 18, 13, 4, 2);
    rect(g, 0x355c2c, 9, 24, 3, 2);
  });

  texture(scene, assetKeys.tiles.tallGrass, 32, 32, (g) => {
    rect(g, 0x3e6a34, 0, 0, 32, 32);
    for (let x = 2; x < 32; x += 6) {
      rect(g, 0x87b957, x, 16, 2, 10);
      rect(g, 0x5d9444, x + 2, 12, 2, 14);
    }
  });

  texture(scene, assetKeys.tiles.path, 32, 32, (g) => {
    rect(g, 0x8d7441, 0, 0, 32, 32);
    rect(g, 0xa98b4c, 3, 5, 8, 3);
    rect(g, 0x6b5a37, 20, 20, 7, 3);
  });

  texture(scene, assetKeys.tiles.stone, 32, 32, (g) => {
    rect(g, 0x6f7f70, 0, 0, 32, 32);
    rect(g, 0x526357, 0, 29, 32, 3);
    rect(g, 0x90a28a, 4, 4, 12, 3);
    rect(g, 0x4a574e, 18, 15, 10, 2);
  });

  texture(scene, assetKeys.tiles.tree, 32, 32, (g) => {
    rect(g, 0x24391f, 0, 0, 32, 32);
    rect(g, 0x4d7433, 2, 4, 28, 20);
    rect(g, 0x76a747, 7, 2, 12, 8);
    rect(g, 0x2f4f2b, 11, 22, 10, 10);
  });

  texture(scene, assetKeys.tiles.rock, 32, 32, (g) => {
    rect(g, 0x426e35, 0, 0, 32, 32);
    rect(g, 0x6f7f70, 6, 10, 20, 14);
    rect(g, 0x91a091, 10, 7, 10, 5);
    rect(g, 0x49564f, 7, 22, 18, 4);
  });

  texture(scene, assetKeys.tiles.water, 32, 32, (g) => {
    rect(g, 0x275d68, 0, 0, 32, 32);
    rect(g, 0x4fa1a6, 3, 10, 10, 2);
    rect(g, 0x80c8bd, 17, 20, 8, 2);
  });

  texture(scene, assetKeys.player, 24, 28, (g) => {
    rect(g, 0x000000, 7, 4, 10, 20, 0.18);
    rect(g, 0xf0c987, 8, 3, 8, 8);
    rect(g, 0x395da8, 6, 11, 12, 11);
    rect(g, 0xb5342f, 5, 12, 5, 5);
    rect(g, 0x223f78, 7, 22, 4, 5);
    rect(g, 0x223f78, 14, 22, 4, 5);
    rect(g, 0xf5edc8, 10, 6, 2, 2);
    rect(g, 0x33251a, 7, 2, 10, 3);
  });

  texture(scene, assetKeys.slime, 24, 18, (g) => {
    rect(g, 0x1d2f20, 3, 12, 18, 4, 0.28);
    rect(g, 0x68b95b, 4, 5, 16, 10);
    rect(g, 0x8ce070, 7, 2, 10, 5);
    rect(g, 0x1f3623, 8, 9, 2, 2);
    rect(g, 0x1f3623, 15, 9, 2, 2);
  });

  texture(scene, assetKeys.goblin, 24, 26, (g) => {
    rect(g, 0x25301e, 4, 21, 16, 4, 0.25);
    rect(g, 0x7aa54a, 7, 3, 10, 9);
    rect(g, 0x516e37, 3, 6, 4, 3);
    rect(g, 0x516e37, 17, 6, 4, 3);
    rect(g, 0x6e4b2c, 6, 12, 12, 9);
    rect(g, 0xe6d08b, 18, 13, 3, 10);
    rect(g, 0x172015, 9, 7, 2, 2);
    rect(g, 0x172015, 14, 7, 2, 2);
  });

  texture(scene, assetKeys.chestClosed, 28, 22, (g) => {
    rect(g, 0x4a2d18, 3, 7, 22, 12);
    rect(g, 0x9f642e, 4, 5, 20, 7);
    rect(g, 0xf2c14e, 13, 9, 3, 5);
    rect(g, 0x2f1b10, 3, 18, 22, 3);
  });

  texture(scene, assetKeys.chestOpen, 28, 24, (g) => {
    rect(g, 0x4a2d18, 3, 10, 22, 11);
    rect(g, 0x9f642e, 5, 3, 18, 7);
    rect(g, 0xf2c14e, 12, 11, 5, 5);
    rect(g, 0xf8e9a1, 8, 8, 12, 3);
  });

  texture(scene, assetKeys.gate, 64, 36, (g) => {
    rect(g, 0x28361f, 0, 0, 64, 36);
    rect(g, 0x724b2a, 8, 4, 8, 30);
    rect(g, 0x724b2a, 28, 4, 8, 30);
    rect(g, 0x724b2a, 48, 4, 8, 30);
    rect(g, 0x4c321f, 5, 12, 54, 7);
    rect(g, 0x6ea346, 2, 0, 60, 5);
    rect(g, 0xf2c14e, 30, 17, 5, 6);
  });

  texture(scene, assetKeys.relic, 28, 30, (g) => {
    rect(g, 0xf2c14e, 12, 2, 5, 5);
    rect(g, 0xf8e9a1, 9, 7, 11, 10);
    rect(g, 0x8ebf55, 7, 17, 15, 8);
    rect(g, 0x355c2c, 11, 25, 7, 4);
  });

  texture(scene, assetKeys.slash, 34, 22, (g) => {
    rect(g, 0xf8e9a1, 5, 3, 24, 4, 0.78);
    rect(g, 0xf2c14e, 11, 9, 18, 3, 0.65);
    rect(g, 0xffffff, 18, 15, 9, 2, 0.55);
  });

  texture(scene, assetKeys.sparkle, 8, 8, (g) => {
    rect(g, 0xffffff, 3, 0, 2, 8);
    rect(g, 0xf2c14e, 0, 3, 8, 2);
  });
}
