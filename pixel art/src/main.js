import * as Phaser from 'phaser';
import './styles.css';
import { GameScene } from './game/scenes/GameScene.js';

const config = {
  type: Phaser.CANVAS,
  parent: 'game-root',
  width: 960,
  height: 640,
  backgroundColor: '#1f3820',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 },
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
};

const game = new Phaser.Game(config);

window.mosskeyGame = game;
