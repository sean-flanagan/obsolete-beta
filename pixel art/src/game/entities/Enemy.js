import * as Phaser from 'phaser';
import { assetKeys } from '../data/assets.js';

export class Enemy {
  constructor(scene, x, y, type = 'slime') {
    this.scene = scene;
    this.type = type;
    this.maxHp = type === 'goblin' ? 3 : 2;
    this.hp = this.maxHp;
    this.speed = type === 'goblin' ? 92 : 58;
    this.touchDamageCooldown = 0;
    this.sprite = scene.physics.add.sprite(x, y, type === 'goblin' ? assetKeys.goblin : assetKeys.slime);
    this.sprite.setDepth(18);
    this.sprite.body.setSize(type === 'goblin' ? 14 : 16, type === 'goblin' ? 16 : 12).setOffset(type === 'goblin' ? 5 : 4, type === 'goblin' ? 9 : 5);
    this.spawn = { x, y };
    this.alive = true;
  }

  update(player, delta) {
    if (!this.alive) return;
    this.touchDamageCooldown = Math.max(0, this.touchDamageCooldown - delta);
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y);
    const chaseRange = this.type === 'goblin' ? 250 : 190;

    if (dist < chaseRange && !player.dead) {
      const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y);
      this.sprite.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
      this.sprite.setFlipX(player.sprite.x < this.sprite.x);
    } else {
      const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.spawn.x, this.spawn.y);
      const homeDist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.spawn.x, this.spawn.y);
      const drift = homeDist > 8 ? this.speed * 0.35 : 0;
      this.sprite.setVelocity(Math.cos(angle) * drift, Math.sin(angle) * drift);
    }
  }

  damage(amount, hit) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.scene.cameras.main.shake(55, 0.0035);
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(75, () => this.sprite.clearTint());
    const angle = Phaser.Math.Angle.Between(hit.x, hit.y, this.sprite.x, this.sprite.y);
    this.sprite.setVelocity(Math.cos(angle) * 210, Math.sin(angle) * 210);

    if (this.hp <= 0) {
      this.alive = false;
      this.sprite.disableBody(true, true);
      this.burst();
      return true;
    }
    return false;
  }

  burst() {
    for (let i = 0; i < 7; i += 1) {
      const sparkle = this.scene.add.image(this.sprite.x, this.sprite.y, assetKeys.sparkle);
      sparkle.setDepth(28).setTint(this.type === 'goblin' ? 0xf2c14e : 0x8ce070);
      this.scene.tweens.add({
        targets: sparkle,
        x: sparkle.x + Phaser.Math.Between(-24, 24),
        y: sparkle.y + Phaser.Math.Between(-24, 24),
        alpha: 0,
        scale: 0.4,
        duration: 360,
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  snapshot() {
    return {
      type: this.type,
      x: Math.round(this.sprite.x),
      y: Math.round(this.sprite.y),
      hp: this.hp,
      alive: this.alive,
    };
  }
}
