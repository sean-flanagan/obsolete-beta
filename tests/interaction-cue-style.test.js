import test from 'node:test';
import assert from 'node:assert/strict';
import { getInteractionCueStyle } from '../src/interaction-cue-style.js';

test('beam cues are stronger than default ring cues for the same tone', () => {
  const ring = getInteractionCueStyle({ tone: 'power', highlightStyle: 'ring', pulse: 0.5 });
  const beam = getInteractionCueStyle({ tone: 'power', highlightStyle: 'beam', pulse: 0.5 });

  assert.equal(ring.palette.ring, '#63ffd1');
  assert.equal(beam.palette.ring, '#63ffd1');
  assert.ok(beam.beaconOpacity > ring.beaconOpacity);
  assert.ok(beam.glowOpacity > ring.glowOpacity);
  assert.ok(beam.capOpacity > ring.capOpacity);
});

test('warning cues stay warmer and more urgent than talk cues', () => {
  const talk = getInteractionCueStyle({ tone: 'talk', highlightStyle: 'ring', pulse: 0.35 });
  const warning = getInteractionCueStyle({ tone: 'warning', highlightStyle: 'ring', pulse: 0.35 });

  assert.equal(talk.palette.ring, '#8effd3');
  assert.equal(warning.palette.ring, '#ff9a73');
  assert.ok(warning.ringOpacity >= talk.ringOpacity);
  assert.ok(warning.capOpacity >= talk.capOpacity);
});

test('beacon style remains visible even when pulse is low', () => {
  const style = getInteractionCueStyle({ tone: 'guide', highlightStyle: 'beacon', pulse: 0.02 });

  assert.equal(style.palette.accent, '#d6f2ff');
  assert.ok(style.beaconOpacity >= 0.3);
  assert.ok(style.capOpacity >= 0.75);
  assert.ok(style.beaconScale.y > 1);
});
