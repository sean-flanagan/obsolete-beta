import * as Phaser from 'phaser';
import { createPixelAssets, assetKeys } from '../data/assets.js';
import { levelRows, levelMeta, TILE_SIZE } from '../data/level1.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { createInput } from '../systems/input.js';
import { createProgression } from '../systems/progression.js';

const hud = () => document.querySelector('#hud-line');
const messageCard = () => document.querySelector('#message-card');

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {}

  create() {
    createPixelAssets(this);
    this.inputMap = createInput(this);
    this.progress = createProgression();
    this.enemies = [];
    this.interactables = [];
    this.mode = 'playing';

    this.physics.world.setBounds(0, 0, levelMeta.width * TILE_SIZE, levelMeta.height * TILE_SIZE);
    this.cameras.main.setBounds(0, 0, levelMeta.width * TILE_SIZE, levelMeta.height * TILE_SIZE);
    this.cameras.main.setZoom(1);

    this.obstacles = this.physics.add.staticGroup();
    this.gateBody = null;
    this.relic = null;
    this.chest = null;

    this.buildLevel();
    this.player = new Player(this, this.spawn.x, this.spawn.y);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    this.physics.add.collider(this.player.sprite, this.obstacles);
    for (const enemy of this.enemies) {
      this.physics.add.collider(enemy.sprite, this.obstacles);
      this.physics.add.collider(enemy.sprite, this.player.sprite, () => this.handlePlayerEnemyTouch(enemy));
      for (const other of this.enemies) {
        if (other !== enemy) this.physics.add.collider(enemy.sprite, other.sprite);
      }
    }

    this.input.keyboard.on('keydown-ENTER', () => this.hideMessage());
    this.showMessage('Mosskey Shrine<br>Find the chest key, open the moss gate, and claim the glowing shrine seed.<br><strong>WASD/Arrows</strong> move, <strong>Space/J</strong> swing, <strong>E/Enter</strong> interact, <strong>R</strong> restart.');
    this.updateHud();
    this.installTestingHooks();
  }

  buildLevel() {
    for (let row = 0; row < levelRows.length; row += 1) {
      for (let col = 0; col < levelRows[row].length; col += 1) {
        const char = levelRows[row][col];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;

        this.add.image(centerX, centerY, this.floorKey(char)).setDepth(0);

        if (char === '#') {
          this.obstacles.create(centerX, centerY, assetKeys.tiles.tree).refreshBody().setDepth(5);
        } else if (char === 'R') {
          this.obstacles.create(centerX, centerY, assetKeys.tiles.rock).refreshBody().setDepth(6);
        } else if (char === '~') {
          this.obstacles.create(centerX, centerY, assetKeys.tiles.water).refreshBody().setDepth(3);
        } else if (char === 'P') {
          this.spawn = { x: centerX, y: centerY };
        } else if (char === 'E') {
          this.enemies.push(new Enemy(this, centerX, centerY, 'slime'));
        } else if (char === 'B') {
          this.enemies.push(new Enemy(this, centerX, centerY, 'goblin'));
        } else if (char === 'C') {
          this.chest = this.physics.add.staticImage(centerX, centerY, assetKeys.chestClosed).setDepth(12);
          this.interactables.push({ type: 'chest', sprite: this.chest });
        } else if (char === 'G') {
          this.gateBody = this.obstacles.create(centerX, centerY, assetKeys.gate);
          this.gateBody.setSize(64, 30).setOffset(0, 4).refreshBody().setDepth(13);
          this.interactables.push({ type: 'gate', sprite: this.gateBody });
        } else if (char === 'A') {
          this.relic = this.physics.add.staticImage(centerX, centerY, assetKeys.relic).setDepth(12);
          this.tweens.add({ targets: this.relic, y: centerY - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        }
      }
    }

    if (!this.spawn) this.spawn = { x: 96, y: 96 };
  }

  floorKey(char) {
    if (char === ',' || char === 'E') return assetKeys.tiles.tallGrass;
    if (char === '=' || char === 'G') return assetKeys.tiles.path;
    if ('CBA'.includes(char)) return assetKeys.tiles.stone;
    return assetKeys.tiles.grass;
  }

  update(_time, delta) {
    if (!this.player) return;

    if (this.inputMap.fullscreenPressed()) this.toggleFullscreen();
    if (this.inputMap.restartPressed()) this.scene.restart();

    if (this.mode === 'won' || this.mode === 'dead') {
      this.player.sprite.setVelocity(0, 0);
      return;
    }

    this.player.update(this.inputMap, delta);
    if (this.inputMap.attackPressed() && this.player.canAttack()) this.handleAttack();
    if (this.inputMap.interactPressed()) this.handleInteract();

    for (const enemy of this.enemies) enemy.update(this.player, delta);
    this.checkRelic();
    this.sortDepths();
    this.updateHud();

    if (this.player.dead && this.mode !== 'dead') {
      this.mode = 'dead';
      this.showMessage('The shrine moss gets quiet...<br><strong>Press R</strong> to try again.');
      this.updateHud();
    }
  }

  handleAttack() {
    const hit = this.player.attack();
    let defeated = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const distance = Phaser.Math.Distance.Between(hit.x, hit.y, enemy.sprite.x, enemy.sprite.y);
      if (distance <= hit.radius) {
        if (enemy.damage(1, hit)) defeated += 1;
      }
    }

    if (defeated > 0) {
      this.progress.enemiesDefeated += defeated;
      this.progress.message = defeated === 1 ? 'A moss beast pops into sparkles.' : `${defeated} moss beasts burst into sparkles.`;
    }
  }

  handlePlayerEnemyTouch(enemy) {
    if (!enemy.alive || enemy.touchDamageCooldown > 0) return;
    const damaged = this.player.takeDamage(enemy.sprite);
    if (damaged) {
      enemy.touchDamageCooldown = 780;
      this.progress.message = 'Oof. The shrine bites back.';
      this.updateHud();
    }
  }

  handleInteract() {
    const nearest = this.nearestInteractable();
    if (!nearest) {
      this.progress.message = 'Nothing nearby to use.';
      this.quickMessage(this.progress.message);
      return;
    }

    if (nearest.type === 'chest') this.openChest();
    if (nearest.type === 'gate') this.openGate();
  }

  nearestInteractable() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const item of this.interactables) {
      if (item.type === 'chest' && this.progress.chestOpened) continue;
      if (item.type === 'gate' && this.progress.gateOpened) continue;
      const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, item.sprite.x, item.sprite.y);
      if (distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    return nearestDistance <= 58 ? nearest : null;
  }

  openChest() {
    if (this.progress.chestOpened) return;
    this.progress.chestOpened = true;
    this.progress.hasKey = true;
    this.chest.setTexture(assetKeys.chestOpen);
    this.progress.message = 'You found the mosskey. The gate lock hums nearby.';
    this.sparkleAt(this.chest.x, this.chest.y - 10, 0xf2c14e);
    this.quickMessage(this.progress.message);
  }

  openGate() {
    if (!this.progress.hasKey) {
      this.progress.message = 'The moss gate is locked. A chest key should fit it.';
      this.quickMessage(this.progress.message);
      return;
    }
    if (this.progress.gateOpened) return;
    this.progress.gateOpened = true;
    this.progress.message = 'The moss gate creaks open. The shrine seed waits below.';
    this.sparkleAt(this.gateBody.x, this.gateBody.y, 0x8ebf55);
    this.gateBody.disableBody(true, true);
    this.quickMessage(this.progress.message);
  }

  checkRelic() {
    if (!this.relic || this.progress.relicClaimed) return;
    const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, this.relic.x, this.relic.y);
    if (distance <= 42 && !this.progress.gateOpened) {
      this.progress.message = 'The shrine seed is sealed behind the moss gate magic.';
      return;
    }
    if (distance <= 42) {
      this.progress.relicClaimed = true;
      this.mode = 'won';
      this.player.sprite.setVelocity(0, 0);
      this.sparkleAt(this.relic.x, this.relic.y, 0xf8e9a1, 18);
      this.relic.setTint(0xffffff);
      this.showMessage('You claimed the Shrine Seed.<br>The grove exhales, the slimes forgive you probably, and your tiny adventure is complete.<br><strong>Press R</strong> to play again.');
      this.updateHud();
    }
  }

  sparkleAt(x, y, tint = 0xf2c14e, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const sparkle = this.add.image(x, y, assetKeys.sparkle).setTint(tint).setDepth(32);
      this.tweens.add({
        targets: sparkle,
        x: x + Phaser.Math.Between(-38, 38),
        y: y + Phaser.Math.Between(-38, 38),
        alpha: 0,
        scale: Phaser.Math.FloatBetween(0.4, 1.5),
        duration: Phaser.Math.Between(320, 680),
        ease: 'Cubic.out',
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  quickMessage(text) {
    this.showMessage(text);
    this.time.delayedCall(1800, () => this.hideMessage());
    this.updateHud();
  }

  showMessage(html) {
    const card = messageCard();
    if (!card) return;
    card.innerHTML = html;
    card.classList.remove('hidden');
  }

  hideMessage() {
    const card = messageCard();
    if (!card) return;
    card.classList.add('hidden');
  }

  updateHud() {
    const el = hud();
    if (!el || !this.player) return;
    const health = `HP ${Math.max(0, this.player.health)}/${this.player.maxHealth}`;
    const key = this.progress.hasKey ? 'Key: yes' : 'Key: no';
    const enemiesLeft = this.enemies.filter((enemy) => enemy.alive).length;
    const goal = this.mode === 'won' ? 'Shrine restored' : this.progress.gateOpened ? 'Claim the seed' : this.progress.hasKey ? 'Open the gate' : 'Find the key';
    el.textContent = `${health} | ${key} | Enemies: ${enemiesLeft} | ${goal}`;
  }

  sortDepths() {
    this.player.sprite.setDepth(20 + this.player.sprite.y / 1000);
    for (const enemy of this.enemies) enemy.sprite.setDepth(18 + enemy.sprite.y / 1000);
  }

  toggleFullscreen() {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  }

  installTestingHooks() {
    window.render_game_to_text = () => JSON.stringify(this.snapshot());
    if (typeof window.advanceTime !== 'function') {
      window.advanceTime = () => Promise.resolve(window.render_game_to_text());
    }
  }

  snapshot() {
    return {
      mode: this.mode,
      coordinateSystem: 'origin top-left, x right, y down, pixels',
      map: { width: levelMeta.width * TILE_SIZE, height: levelMeta.height * TILE_SIZE, tileSize: TILE_SIZE },
      player: this.player?.snapshot(),
      progression: {
        hasKey: this.progress.hasKey,
        chestOpened: this.progress.chestOpened,
        gateOpened: this.progress.gateOpened,
        relicClaimed: this.progress.relicClaimed,
        enemiesDefeated: this.progress.enemiesDefeated,
        message: this.progress.message,
      },
      objects: {
        chest: this.chest ? { x: Math.round(this.chest.x), y: Math.round(this.chest.y), opened: this.progress.chestOpened } : null,
        gate: this.gateBody ? { x: Math.round(this.gateBody.x), y: Math.round(this.gateBody.y), opened: this.progress.gateOpened } : null,
        relic: this.relic ? { x: Math.round(this.relic.x), y: Math.round(this.relic.y), claimed: this.progress.relicClaimed } : null,
      },
      enemies: this.enemies.map((enemy) => enemy.snapshot()),
    };
  }
}
