const DEFAULT_PALETTES = {
  talk: { ring: '#8effd3', accent: '#dffef0' },
  guide: { ring: '#9adfff', accent: '#d6f2ff' },
  power: { ring: '#63ffd1', accent: '#fff0aa' },
  warning: { ring: '#ff9a73', accent: '#ffd37d' },
  exit: { ring: '#ffe38a', accent: '#fff8c8' },
};

const clampPulse = (pulse) => Math.max(0, Math.min(1, pulse));

export function getInteractionCueStyle({ tone = 'talk', highlightStyle = 'ring', pulse = 0.5 } = {}) {
  const safePulse = clampPulse(pulse);
  const palette = DEFAULT_PALETTES[tone] || DEFAULT_PALETTES.talk;

  const ringOpacityBase = highlightStyle === 'beam' ? 0.34 : highlightStyle === 'beacon' ? 0.3 : 0.28;
  const ringOpacityBoost = highlightStyle === 'beam' ? 0.28 : highlightStyle === 'beacon' ? 0.24 : 0.2;

  const glowOpacityBase = highlightStyle === 'beam' ? 0.18 : highlightStyle === 'beacon' ? 0.14 : 0.1;
  const glowOpacityBoost = highlightStyle === 'beam' ? 0.22 : highlightStyle === 'beacon' ? 0.18 : 0.12;
  const glowScale = highlightStyle === 'beam' ? 1.08 + safePulse * 0.28 : highlightStyle === 'beacon' ? 1.02 + safePulse * 0.22 : 0.98 + safePulse * 0.18;

  const beaconOpacityBase = highlightStyle === 'beam' ? 0.42 : highlightStyle === 'beacon' ? 0.3 : 0.14;
  const beaconOpacityBoost = highlightStyle === 'beam' ? 0.26 : highlightStyle === 'beacon' ? 0.2 : 0.08;
  const beaconScale = {
    x: highlightStyle === 'beam' ? 1.12 + safePulse * 0.26 : highlightStyle === 'beacon' ? 1 + safePulse * 0.18 : 0.9 + safePulse * 0.12,
    y: highlightStyle === 'beam' ? 1.22 + safePulse * 0.36 : highlightStyle === 'beacon' ? 1.08 + safePulse * 0.24 : 0.96 + safePulse * 0.14,
  };

  const capOpacityBase = highlightStyle === 'ring' ? 0.58 : 0.78;
  const capOpacityBoost = highlightStyle === 'ring' ? 0.18 : 0.16;
  const capScale = highlightStyle === 'ring' ? 0.96 + safePulse * 0.2 : 1.08 + safePulse * 0.24;

  const warningBoost = tone === 'warning' ? 0.04 : 0;

  return {
    palette,
    ringOpacity: ringOpacityBase + safePulse * ringOpacityBoost + warningBoost,
    glowOpacity: glowOpacityBase + safePulse * glowOpacityBoost + warningBoost,
    glowScale,
    beaconOpacity: beaconOpacityBase + safePulse * beaconOpacityBoost,
    beaconScale,
    capOpacity: Math.min(1, capOpacityBase + safePulse * capOpacityBoost + warningBoost),
    capScale,
  };
}
