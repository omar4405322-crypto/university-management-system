export type ShaheenApplicationState = 'idle' | 'thinking' | 'responding' | 'success' | 'warning' | 'error' | 'disabled';
export type ShaheenInteractionState = 'resting' | 'hover' | 'interacting' | 'reduced-motion';
export type ShaheenQuality = 'low' | 'medium' | 'high';
export interface OrbControls {
  applicationState?: ShaheenApplicationState;
  quality?: ShaheenQuality;
  interactionEnabled?: boolean;
  energy?: number;
  glow?: number;
  idle: boolean;
  orbits: boolean;
  particles: boolean;
  capMode: 'camera' | 'surface';
}
export interface OrbState {
  applicationState: ShaheenApplicationState;
  interactionState: ShaheenInteractionState;
  quality: ShaheenQuality;
  dpr: number;
  energy: number;
  orbitSpeed: number;
  amber: number;
  webgl: 'ready' | 'failed';
  geometry: string;
  surfaceAngle: number;
  rings: number[];
  reduced: boolean;
  size: number;
  interactive: boolean;
  orientation: number[];
  speed: number;
  dragging: boolean;
  resetting: boolean;
  idleBlend: number;
  idleEnabled: boolean;
  capMode: 'camera' | 'surface';
  orbitTime: number;
  particleTime: number;
}
export interface OrbRenderer {
  draw(seconds: number, still?: boolean, paused?: boolean): void;
  syncTime(seconds: number): void;
  reset(): void;
  configure(values: Partial<OrbControls>): void;
  state(): OrbState;
  dispose(): void;
}
export function createOrb(host: HTMLDivElement, variant: number, cap: HTMLDivElement, aura: HTMLDivElement,
  shadow: HTMLDivElement, hit?: HTMLButtonElement | null,
  lifecycle?: { onFrame?: () => void; onError?: () => void }): OrbRenderer;
