import * as Phaser from 'phaser';

export function createInput(scene) {
  const cursors = scene.input.keyboard.createCursorKeys();
  const keys = scene.input.keyboard.addKeys({
    up: 'W',
    down: 'S',
    left: 'A',
    right: 'D',
    attack: 'SPACE',
    attackAlt: 'J',
    interact: 'E',
    interactAlt: 'ENTER',
    restart: 'R',
    fullscreen: 'F',
    pause: 'ESC',
  });

  return {
    movement() {
      const x = Number(cursors.right.isDown || keys.right.isDown) - Number(cursors.left.isDown || keys.left.isDown);
      const y = Number(cursors.down.isDown || keys.down.isDown) - Number(cursors.up.isDown || keys.up.isDown);
      return { x, y };
    },
    attackPressed() {
      return Phaser.Input.Keyboard.JustDown(keys.attack) || Phaser.Input.Keyboard.JustDown(keys.attackAlt);
    },
    interactPressed() {
      return Phaser.Input.Keyboard.JustDown(keys.interact) || Phaser.Input.Keyboard.JustDown(keys.interactAlt);
    },
    restartPressed() {
      return Phaser.Input.Keyboard.JustDown(keys.restart);
    },
    fullscreenPressed() {
      return Phaser.Input.Keyboard.JustDown(keys.fullscreen);
    },
    pausePressed() {
      return Phaser.Input.Keyboard.JustDown(keys.pause);
    },
  };
}
