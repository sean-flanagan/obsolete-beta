import * as Phaser from 'phaser';
import { assetKeys } from '../data/assets.js';
import { directionOffset } from '../systems/combat.js';

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, assetKeys.player);
    this.sprite.setDepth(20);
    this.sprite.body.setSize(14, 14).setOffset(5, 12);
    this.speed = 150;
    this.health = 3;
    this.maxHealth = 3;
    this.direction = 'down';
    this.attackCooldown = 0;
    this.invulnerable = 0;
    this.dead = false;
  }

  update(input, delta) {
    if (this.dead) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.invulnerable = Math.max(0, this.invulnerable - delta);

    const move = input.movement();
    const vector = new Phaser.Math.Vector2(move.x, move.y);
    if (vector.lengthSq() > 0) {
      vector.normalize();
      if (Math.abs(vector.x) > Math.abs(vector.y)) {
        this.direction = vector.x < 0 ? 'left' : 'right';
      } else {
        this.direction = vector.y < 0 ? 'up' : 'down';
      }
    }

    this.sprite.setVelocity(vector.x * this.speed, vector.y * this.speed);
    this.sprite.setFlipX(this.direction === 'left');
    this.sprite.setAlpha(this.invulnerable > 0 && Math.floor(this.invulnerable / 70) % 2 === 0 ? 0.45 : 1);
  }

  canAttack() {
    return this.attackCooldown <= 0 && !this.dead;
  }

  attack() {
    this.attackCooldown = 260;
    const offset = directionOffset(this.direction, 26);
    const slash = this.scene.add.image(this.sprite.x + offset.x, this.sprite.y + offset.y, assetKeys.slash);
    slash.setDepth(30).setAngle(offset.angle).setAlpha(0.92);
    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.35,
      duration: 120,
      onComplete: () => slash.destroy(),
    });
    return {
      x: this.sprite.x + offset.x,
      y: this.sprite.y + offset.y,
      radius: 34,
      direction: this.direction,
    };
  }

  takeDamage(source) {
    if (this.invulnerable > 0 || this.dead) return false;
    this.health -= 1;
    this.invulnerable = 900;
    const angle = Phaser.Math.Angle.Between(source.x, source.y, this.sprite.x, this.sprite.y);
    this.sprite.setVelocity(Math.cos(angle) * 260, Math.sin(angle) * 260);
    this.scene.cameras.main.shake(90, 0.006);
    if (this.health <= 0) {
      this.dead = true;
      this.sprite.setTint(0x6c4652);
    }
    return true;
  }

  snapshot() {
    return {
      x: Math.round(this.sprite.x),
      y: Math.round(this.sprite.y),
      health: this.health,
      direction: this.direction,
      dead: this.dead,
    };
  }
}
