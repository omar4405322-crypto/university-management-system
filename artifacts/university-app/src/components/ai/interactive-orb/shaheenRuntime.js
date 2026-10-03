export const APPLICATION_STATES = ['idle', 'thinking', 'responding', 'success', 'warning', 'error', 'disabled'];
export const STATE_VISUALS = {
  idle: { energy: 1, orbitSpeed: 1, activity: 1, amber: 0, saturation: 1, pulse: 0 },
  thinking: { energy: 1.22, orbitSpeed: 1.45, activity: 1.25, amber: 0, saturation: 1, pulse: .01 },
  responding: { energy: 1.1, orbitSpeed: 1.15, activity: 1.1, amber: 0, saturation: 1, pulse: .025 },
  success: { energy: 1.2, orbitSpeed: 1.1, activity: 1.1, amber: 0, saturation: 1, pulse: .035 },
  warning: { energy: .96, orbitSpeed: .85, activity: .85, amber: .12, saturation: 1, pulse: .005 },
  error: { energy: .72, orbitSpeed: .45, activity: .6, amber: .08, saturation: 1, pulse: 0 },
  disabled: { energy: .65, orbitSpeed: 0, activity: 0, amber: 0, saturation: .55, pulse: 0 },
};
export const QUALITY_TIERS = {
  low: { dpr: 1, samples: 3, particles: 2 },
  medium: { dpr: 1.25, samples: 4, particles: 3 },
  high: { dpr: 1.75, samples: 6, particles: 5 },
};
// Mutate one persistent frame object; no allocations or React updates per frame.
export function approachVisual(current, target, dt) {
  const factor = 1 - Math.exp(-4 * Math.max(0, dt));
  for (const key in target) current[key] += (target[key] - current[key]) * factor;
}
