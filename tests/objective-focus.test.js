import test from 'node:test';
import assert from 'node:assert/strict';
import { getObjectiveFocus } from '../src/objective-focus.js';

test('targets nearest NPC from anywhere when the first goal is to talk to a machine', () => {
  const focus = getObjectiveFocus({
    act: {
      npcs: [
        { id: 'crt', name: 'Bitter CRT', x: 360, y: 565, w: 54, h: 54, portrait: 'crt' },
        { id: 'modem', name: 'Wise Old Modem', x: 665, y: 520, w: 48, h: 48, portrait: 'modem' },
      ],
      socket: { x: 1180, y: 560, w: 74, h: 74 },
      battery: { x: 860, y: 580, w: 56, h: 48 },
    },
    progress: { act1TalkedToMachine: false, batterySocketPowered: false },
  });

  assert.equal(focus.type, 'objectiveNpc');
  assert.equal(focus.label, 'Talk to Bitter CRT');
  assert.equal(focus.highlightStyle, 'beam');
});

test('targets the floppy disk before the gate console in chapter 2', () => {
  const focus = getObjectiveFocus({
    act: {
      items: [{ id: 'floppy', x: 1800, y: 480, w: 42, h: 28, text: 'disk' }],
      gateConsole: { x: 2100, y: 440, w: 72, h: 72 },
    },
    progress: { hasFloppy: false, act2GateOpen: false },
  });

  assert.equal(focus.type, 'floppy');
  assert.equal(focus.label, 'Recover the floppy disk');
  assert.equal(focus.tone, 'guide');
});

test('targets the exit route once the current level can be left', () => {
  const focus = getObjectiveFocus({
    act: {
      exitZone: { x: 1490, y: 335, w: 140, h: 220, requires: 'diagnosticPassed' },
    },
    progress: { diagnosticPassed: true },
  });

  assert.equal(focus.type, 'exit');
  assert.equal(focus.label, 'Head for the exit route');
  assert.equal(focus.tone, 'exit');
  assert.equal(focus.highlightStyle, 'beam');
});
