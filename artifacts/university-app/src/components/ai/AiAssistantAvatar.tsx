import React, { lazy, Suspense, useEffect, useState, useMemo } from 'react';
import { Sparkles, GraduationCap, AlertCircle, Check, Loader2, Volume2, Mic } from 'lucide-react';

export type AiCharacterState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success' | 'error';
export type AiCharacterRenderer = 'placeholder' | 'static-image' | 'rive' | 'live2d' | 'three';
export type AiCharacterSize = 'sm' | 'md' | 'lg' | 'hero';

const Interactive3DOrb = lazy(() => import('./interactive-orb/Interactive3DOrb'));

class ModelBoundary extends React.Component<{ children: React.ReactNode; onReady: (ready: boolean) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onReady(false); }
  render() { return this.state.failed ? null : this.props.children; }
}

export interface AiAssistantAvatarProps {
  state?: AiCharacterState;
  size?: AiCharacterSize;
  renderer?: AiCharacterRenderer;
  className?: string;
  assetUrl?: string;
  fallbackImageUrl?: string;
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * Pure state-mapping helper: translates AI workspace UI flags into character state
 */
export function deriveAiCharacterState({
  isSending,
  hasDraft,
  isStreaming = false,
  isSuccess = false,
  hasError = false,
}: {
  isSending: boolean;
  hasDraft: boolean;
  isStreaming?: boolean;
  isSuccess?: boolean;
  hasError: boolean;
}): AiCharacterState {
  if (hasError) return 'error';
  if (isSuccess) return 'success';
  if (isSending) {
    return isStreaming ? 'speaking' : 'thinking';
  }
  if (hasDraft) return 'listening';
  return 'idle';
}

/**
 * Hook to detect user preference for reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook to pause animations when page/tab is hidden
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibilityChange = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return isVisible;
}

/**
 * Dimensions mapping for responsive avatar sizing
 */
const sizeClasses: Record<AiCharacterSize, { container: string; icon: number; badge: string }> = {
  hero: {
    container: 'h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-3xl',
    icon: 32,
    badge: 'h-6 w-6 -top-1.5 -end-1.5 text-xs',
  },
  lg: {
    container: 'h-14 w-14 sm:h-16 sm:w-16 rounded-2xl',
    icon: 26,
    badge: 'h-5 w-5 -top-1 -end-1 text-[11px]',
  },
  md: {
    container: 'h-12 w-12 rounded-xl',
    icon: 22,
    badge: 'h-4 w-4 -top-1 -end-1 text-[9px]',
  },
  sm: {
    container: 'h-8 w-8 rounded-lg',
    icon: 16,
    badge: 'h-3.5 w-3.5 -top-0.5 -end-0.5 text-[8px]',
  },
};

/**
 * State visual configurations for the neutral university AI identity placeholder
 */
const stateVisualConfigs: Record<
  AiCharacterState,
  {
    bgGradient: string;
    ringColor: string;
    badgeBg: string;
    pulseEffect: string;
    BadgeIcon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
    statusText: string;
  }
> = {
  idle: {
    bgGradient: 'from-brand-primary-600/20 via-brand-primary-500/10 to-transparent',
    ringColor: 'ring-brand-primary-500/30 border-brand-primary-500/30',
    badgeBg: 'bg-brand-primary-600 text-white',
    pulseEffect: '',
    BadgeIcon: Sparkles,
    statusText: 'المساعد جاهز',
  },
  listening: {
    bgGradient: 'from-brand-primary-500/25 via-brand-primary-500/15 to-transparent',
    ringColor: 'ring-brand-primary-500/40 border-brand-primary-500/40',
    badgeBg: 'bg-brand-primary-600 text-white',
    pulseEffect: 'animate-pulse',
    BadgeIcon: Mic,
    statusText: 'المساعد يستمع',
  },
  thinking: {
    bgGradient: 'from-amber-500/20 via-brand-primary-500/15 to-transparent',
    ringColor: 'ring-amber-500/40 border-amber-500/40',
    badgeBg: 'bg-amber-600 text-white',
    pulseEffect: '',
    BadgeIcon: Loader2,
    statusText: 'المساعد يفكر...',
  },
  speaking: {
    bgGradient: 'from-cyan-500/25 via-brand-primary-500/20 to-transparent',
    ringColor: 'ring-cyan-500/40 border-cyan-500/40',
    badgeBg: 'bg-cyan-600 text-white',
    pulseEffect: 'animate-pulse',
    BadgeIcon: Volume2,
    statusText: 'المساعد يتحدث',
  },
  success: {
    bgGradient: 'from-brand-primary-600/25 via-brand-primary-500/15 to-transparent',
    ringColor: 'ring-brand-primary-500/50 border-brand-primary-500/50',
    badgeBg: 'bg-brand-primary-600 text-white',
    pulseEffect: '',
    BadgeIcon: Check,
    statusText: 'تمت العملية بنجاح',
  },
  error: {
    bgGradient: 'from-rose-500/25 via-brand-primary-500/15 to-transparent',
    ringColor: 'ring-rose-500/40 border-rose-500/40',
    badgeBg: 'bg-rose-600 text-white',
    pulseEffect: '',
    BadgeIcon: AlertCircle,
    statusText: 'حدث خطأ في الاستجابة',
  },
};

/**
 * 1. Placeholder Renderer:
 * The default university AI identity visual with concentric glow rings, emblem, and status badge.
 */
function PlaceholderRenderer({
  state,
  size,
  prefersReducedMotion,
  isPageVisible,
  showModel = false,
}: {
  state: AiCharacterState;
  size: AiCharacterSize;
  prefersReducedMotion: boolean;
  isPageVisible: boolean;
  showModel?: boolean;
}) {
  const [modelReady, setModelReady] = useState(false);
  const config = stateVisualConfigs[state];
  const dims = sizeClasses[size];
  const { BadgeIcon } = config;
  const isAnimating = isPageVisible && !prefersReducedMotion;

  if (size === 'hero') {
    return (
      <div
        data-testid="ai-character-placeholder"
        data-character-state={state}
        className="relative flex items-center justify-center transition-transform duration-300 ease-in-out py-2 select-none"
      >
        {/* Ambient Emerald Glow Aura behind orb */}
        <div
          className={`absolute inset-0 m-auto w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-brand-primary-400/30 dark:bg-brand-primary-500/20 blur-2xl -z-10 pointer-events-none ${showModel && modelReady ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden="true"
        />

        {/* Ambient Wavy Green Particle Streams (SVG) matching IMAGE B */}
        <div className="absolute -inset-x-32 -inset-y-12 -z-10 pointer-events-none opacity-85 overflow-visible" aria-hidden="true">
          <svg viewBox="0 0 720 240" fill="none" className="w-full h-full text-brand-primary-500/30">
            <path
              d="M 10 120 C 150 40, 270 190, 410 100 C 530 30, 610 150, 710 120"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="6 4"
              className={isAnimating ? 'animate-pulse' : ''}
            />
            <path
              d="M 20 135 C 180 180, 320 70, 480 130 C 560 160, 640 95, 710 130"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.6"
            />
          </svg>
        </div>

        {/* Central Orb & Orbit Canvas */}
        <div className="relative flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48">
          {/* Orbital Rings with Glowing Satellite Beads */}
          <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 motion-reduce:transition-none ${showModel && modelReady ? 'opacity-0' : 'opacity-100'}`} data-testid="ai-hero-fallback-decorations" aria-hidden="true">
            <svg viewBox="0 0 220 220" className="w-full h-full overflow-visible">
              <defs>
                <filter id="hero-orb-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {/* Tilted Ellipse Orbit 1 */}
              <ellipse
                cx="110"
                cy="110"
                rx="98"
                ry="34"
                transform="rotate(-22 110 110)"
                fill="none"
                stroke="var(--brand-green-light, #A1C04F)"
                strokeWidth="1.75"
                strokeDasharray="7 4"
                opacity="0.85"
              />
              {/* Tilted Ellipse Orbit 2 */}
              <ellipse
                cx="110"
                cy="110"
                rx="92"
                ry="38"
                transform="rotate(30 110 110)"
                fill="none"
                stroke="var(--brand-green, #8BB83C)"
                strokeWidth="1.75"
                opacity="0.9"
              />
              {/* Glowing Satellite Beads matching IMAGE B */}
              <circle cx="28" cy="86" r="4.5" fill="var(--brand-green-light, #A1C04F)" filter="url(#hero-orb-glow)" />
              <circle cx="192" cy="134" r="4" fill="var(--brand-primary-200, #d2e1a7)" filter="url(#hero-orb-glow)" />
              <circle cx="132" cy="34" r="3.5" fill="var(--brand-primary-100, #e8f0d3)" />
              <circle cx="88" cy="186" r="4.5" fill="var(--brand-green, #8BB83C)" filter="url(#hero-orb-glow)" />
              <circle cx="168" cy="76" r="3.5" fill="var(--brand-green-light, #A1C04F)" filter="url(#hero-orb-glow)" />
            </svg>
          </div>

          {/* Same central footprint; approved orb remains beneath the lazy transparent scene. */}
          <div className="relative w-22 h-22 sm:w-26 sm:h-26 md:w-28 md:h-28 rounded-full">
          <div className={`absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none ${showModel && modelReady ? 'opacity-0' : 'opacity-100'}`} data-testid="ai-hero-orb-fallback">
          {/* Central Glowing Emerald Sphere */}
          <div
            className={`
              relative w-full h-full rounded-full
              bg-gradient-to-b from-brand-primary-400 via-brand-primary-600 to-brand-primary-800
              shadow-[0_0_40px_rgba(139,184,60,0.45),0_0_80px_rgba(161,192,79,0.25)]
              border-2 border-brand-primary-300/80
              flex items-center justify-center
              overflow-hidden
              transition-transform duration-300
              ${state === 'thinking' && isAnimating ? 'scale-95' : 'hover:scale-105'}
            `}
          >
            {/* Specular top highlight */}
            <div className="absolute top-1 inset-x-3.5 h-7 rounded-full bg-gradient-to-b from-white/50 to-transparent blur-[1px] pointer-events-none" />
            
            {/* Inner depth shadow */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_-10px_20px_rgba(51,69,23,0.9)] pointer-events-none" />

            {/* Crisp White Graduation Cap */}
            <GraduationCap
              size={36}
              strokeWidth={2}
              className="text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.4)] relative z-10"
              aria-hidden="true"
            />
          </div>
          </div>
          </div>
          {showModel ? (
            <div className={`absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none ${modelReady ? 'opacity-100' : 'opacity-0'}`} inert={!modelReady} aria-hidden={!modelReady}>
              <ModelBoundary onReady={setModelReady}>
                <Suspense fallback={null}>
                  <Interactive3DOrb className="ai-hero-orb" prefersReducedMotion={prefersReducedMotion} isPageVisible={isPageVisible} onReady={setModelReady} />
                </Suspense>
              </ModelBoundary>
            </div>
          ) : null}

          {/* State Status Badge */}
          <div
            data-testid={`ai-character-badge-${state}`}
            className={`
              absolute flex items-center justify-center rounded-full shadow-md
              ${config.badgeBg} ${dims.badge} ring-2 ring-white dark:ring-slate-900
              transition-colors duration-200 z-20
            `}
            aria-hidden="true"
          >
            <BadgeIcon
              size={14}
              className={`${state === 'thinking' && isAnimating ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="ai-character-placeholder"
      data-character-state={state}
      className={`
        relative flex items-center justify-center border shadow-md
        bg-gradient-to-b ${config.bgGradient} ${config.ringColor} ${dims.container}
        transition-all duration-300 ease-in-out
      `}
    >
      {/* Outer Glow Halo (paused when reduced motion or tab hidden) */}
      <div
        className={`
          absolute -inset-1 rounded-[inherit] bg-brand-primary-500/15 blur-md -z-10
          ${isAnimating && config.pulseEffect ? config.pulseEffect : ''}
          motion-reduce:animate-none
        `}
        aria-hidden="true"
      />

      {/* University Identity Icon */}
      <div className="flex items-center justify-center text-brand-primary-700 dark:text-brand-primary-300">
        <GraduationCap
          size={dims.icon}
          strokeWidth={1.8}
          className={`transition-transform duration-300 ${state === 'thinking' && isAnimating ? 'scale-95' : ''}`}
          aria-hidden="true"
        />
      </div>

      {/* State Status Badge */}
      <div
        data-testid={`ai-character-badge-${state}`}
        className={`
          absolute flex items-center justify-center rounded-full shadow-xs
          ${config.badgeBg} ${dims.badge} ring-2 ring-brand-bg-card
          transition-colors duration-200
        `}
        aria-hidden="true"
      >
        <BadgeIcon
          size={10}
          className={`${state === 'thinking' && isAnimating ? 'animate-spin motion-reduce:animate-none' : ''}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * 2. Static Image Renderer Adapter:
 * Prepared for static high-resolution character artwork or transparent PNG fallback.
 */
function StaticImageRenderer({
  src,
  state,
  size,
}: {
  src: string;
  state: AiCharacterState;
  size: AiCharacterSize;
}) {
  const dims = sizeClasses[size];
  return (
    <div
      data-testid="ai-character-static-image"
      data-character-state={state}
      className={`relative overflow-hidden flex items-center justify-center ${dims.container}`}
    >
      <img
        src={src}
        alt="AI Character"
        loading="lazy"
        className="h-full w-full object-contain pointer-events-none select-none transition-transform duration-300"
      />
    </div>
  );
}

/**
 * 3. Rive Animation Renderer Adapter (Stub Architecture):
 * Prepared for plug-and-play Rive runtime (@rive-app/react-canvas) without page restructuring.
 */
function RiveRendererAdapter({
  assetUrl,
  state,
  size,
  prefersReducedMotion,
  isPageVisible,
}: {
  assetUrl?: string;
  state: AiCharacterState;
  size: AiCharacterSize;
  prefersReducedMotion: boolean;
  isPageVisible: boolean;
}) {
  const dims = sizeClasses[size];
  return (
    <div
      data-testid="ai-character-rive-container"
      data-character-state={state}
      data-asset-url={assetUrl}
      data-animation-paused={!isPageVisible || prefersReducedMotion}
      className={`relative flex items-center justify-center ${dims.container}`}
    >
      {/* Target canvas container for Rive runtime initialization */}
      <canvas
        className="h-full w-full object-contain pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * 4. Live2D Animation Renderer Adapter (Stub Architecture):
 * Prepared for plug-and-play Live2D Cubism WebGL runtime.
 */
function Live2DRendererAdapter({
  assetUrl,
  state,
  size,
  prefersReducedMotion,
  isPageVisible,
}: {
  assetUrl?: string;
  state: AiCharacterState;
  size: AiCharacterSize;
  prefersReducedMotion: boolean;
  isPageVisible: boolean;
}) {
  const dims = sizeClasses[size];
  return (
    <div
      data-testid="ai-character-live2d-container"
      data-character-state={state}
      data-asset-url={assetUrl}
      data-animation-paused={!isPageVisible || prefersReducedMotion}
      className={`relative flex items-center justify-center ${dims.container}`}
    >
      {/* Target canvas container for Live2D WebGL initialization */}
      <canvas
        className="h-full w-full object-contain pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * AiAssistantAvatar:
 * Conceptual Character Avatar component representing the university AI assistant.
 * Entirely separate from account user avatars (which are strictly for authenticated users).
 */
export const AiAssistantAvatar: React.FC<AiAssistantAvatarProps> = React.memo(
  ({
    state = 'idle',
    size = 'hero',
    renderer = 'placeholder',
    className = '',
    assetUrl,
    fallbackImageUrl,
    interactive = false,
    onClick,
    ariaLabel,
  }) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const isPageVisible = usePageVisibility();

    // Select the visual renderer strategy based on current configuration
    const content = useMemo(() => {
      switch (renderer) {
        case 'static-image':
          if (fallbackImageUrl) {
            return (
              <StaticImageRenderer
                src={fallbackImageUrl}
                state={state}
                size={size}
              />
            );
          }
          break;
        case 'rive':
          if (assetUrl) {
            return (
              <RiveRendererAdapter
                assetUrl={assetUrl}
                state={state}
                size={size}
                prefersReducedMotion={prefersReducedMotion}
                isPageVisible={isPageVisible}
              />
            );
          }
          break;
        case 'live2d':
          if (assetUrl) {
            return (
              <Live2DRendererAdapter
                assetUrl={assetUrl}
                state={state}
                size={size}
                prefersReducedMotion={prefersReducedMotion}
                isPageVisible={isPageVisible}
              />
            );
          }
          break;
        case 'placeholder':
        default:
          break;
      }

      // Default safe fallback: neutral university identity placeholder
      return (
        <PlaceholderRenderer
          state={state}
          size={size}
          prefersReducedMotion={prefersReducedMotion}
          isPageVisible={isPageVisible}
          showModel={renderer === 'three' && size === 'hero'}
        />
      );
    }, [renderer, assetUrl, fallbackImageUrl, state, size, prefersReducedMotion, isPageVisible]);

    const wrapperProps = interactive
      ? {
          role: 'button',
          tabIndex: 0,
          onClick,
          'aria-label': ariaLabel || stateVisualConfigs[state].statusText,
          className: `inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-500 cursor-pointer ${className}`,
        }
      : renderer === 'three' && size === 'hero' ? {
          className: `inline-flex shrink-0 select-none ${className}`,
        } : {
          'aria-hidden': true as const,
          className: `inline-flex shrink-0 select-none ${className}`,
        };

    return (
      <div
        data-testid="ai-assistant-avatar"
        data-renderer={renderer}
        data-state={state}
        data-size={size}
        {...wrapperProps}
      >
        {content}
      </div>
    );
  }
);

AiAssistantAvatar.displayName = 'AiAssistantAvatar';

export default AiAssistantAvatar;
