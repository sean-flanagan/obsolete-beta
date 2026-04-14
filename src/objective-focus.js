const centerOf = (entity) => ({
  x: entity.x + entity.w / 2,
  y: entity.y + entity.h / 2,
});

const distanceBetween = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

const withRect = (type, entity, extras = {}) => ({
  type,
  x: entity.x,
  y: entity.y,
  w: entity.w,
  h: entity.h,
  ...extras,
});

export function getObjectiveFocus({ act, progress, player } = {}) {
  if (!act) return null;

  const playerCenter = player ? centerOf(player) : null;

  if (!progress?.act1TalkedToMachine && (act.npcs || []).length) {
    const npcs = [...act.npcs];
    if (playerCenter) {
      npcs.sort((a, b) => distanceBetween(centerOf(a), playerCenter) - distanceBetween(centerOf(b), playerCenter));
    }
    const npc = npcs[0];
    return withRect('objectiveNpc', npc, {
      label: `Talk to ${npc.name}`,
      tone: npc.portrait === 'modem' ? 'guide' : 'talk',
      highlightStyle: 'beam',
    });
  }

  if (act.socket && act.battery && !progress?.batterySocketPowered) {
    return withRect('socket', act.socket, {
      label: 'Push the battery into the socket',
      tone: 'power',
      highlightStyle: 'beam',
    });
  }

  if (act.gateConsole && !progress?.act2GateOpen) {
    const floppy = (act.items || []).find((item) => item.id === 'floppy' && !item.collected);
    if (!progress?.hasFloppy && floppy) {
      return withRect('floppy', floppy, {
        label: 'Recover the floppy disk',
        tone: 'guide',
        highlightStyle: 'beam',
      });
    }

    return withRect('gateConsole', act.gateConsole, {
      label: 'Use the gate console',
      tone: 'power',
      highlightStyle: 'beam',
    });
  }

  if (act.console && !progress?.diagnosticPassed) {
    return withRect('finalConsole', act.console, {
      label: 'Reach the diagnostic console',
      tone: 'guide',
      highlightStyle: 'beam',
    });
  }

  if (act.exitZone) {
    const canExit = !act.exitZone.requires || progress?.[act.exitZone.requires];
    if (canExit) {
      return withRect('exit', act.exitZone, {
        label: 'Head for the exit route',
        tone: 'exit',
        highlightStyle: 'beam',
      });
    }
  }

  return null;
}
