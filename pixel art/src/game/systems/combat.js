import * as Phaser from 'phaser';

export function directionOffset(direction, distance) {
  switch (direction) {
    case 'up':
      return { x: 0, y: -distance, angle: -90 };
    case 'down':
      return { x: 0, y: distance, angle: 90 };
    case 'left':
      return { x: -distance, y: 0, angle: 180 };
    default:
      return { x: distance, y: 0, angle: 0 };
  }
}

export function overlapDistance(a, b) {
  return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
}
