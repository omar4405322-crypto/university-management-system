import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { noPadding?: boolean }
>(({ className, noPadding, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-brand-border bg-brand-bg-card text-brand-text-primary shadow-sm transition-[border-color,box-shadow,background-color]",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-bold text-base md:text-lg leading-snug tracking-heading text-brand-text-primary", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

export type StatCardColor =
  | 'primary'
  | 'green'
  | 'emerald'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'amber'
  | 'yellow'
  | 'orange'
  | 'rose'
  | 'red'
  | 'navy'
  | 'cyan'
  | 'gold';

export const STAT_CARD_BRAND_SEQUENCE: StatCardColor[] = ['green', 'navy', 'cyan', 'gold'];

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string | React.ReactNode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: StatCardColor;
  colorIndex?: number;
  onClick?: () => void;
  isActive?: boolean;
  alert?: boolean;
  alertLabel?: string;
  className?: string;
  hasLink?: boolean;
  compact?: boolean;
}

const colorStyles: Record<
  StatCardColor,
  {
    borderHover: string;
    borderActive: string;
    shadowHover: string;
    iconWrapper: string;
    valueText: string;
    linkIconColor: string;
  }
> = {
  /*
   * Standard 4-color institutional brand palette (Solid badges with white icons):
   * 1. Primary University Green: #8BB83C
   * 2. Secondary Dark Navy: #1B2E42 (Balanced Institutional Navy)
   * 3. Tertiary Deep Cyan: #2F6B87
   * 4. Quaternary University Gold / Amber: #D6BA34
   */
  primary: {
    borderHover: 'hover:border-brand-green',
    borderActive: 'border-brand-green ring-2 ring-brand-green/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(139,184,60,0.35)]',
    iconWrapper:
      'bg-[#8BB83C] text-white shadow-md shadow-[#8BB83C]/30 group-hover:shadow-[0_6px_20px_rgba(139,184,60,0.45)]',
    valueText: 'text-brand-green dark:text-brand-primary-400',
    linkIconColor: 'text-brand-green',
  },
  green: {
    borderHover: 'hover:border-brand-green',
    borderActive: 'border-brand-green ring-2 ring-brand-green/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(139,184,60,0.35)]',
    iconWrapper:
      'bg-[#8BB83C] text-white shadow-md shadow-[#8BB83C]/30 group-hover:shadow-[0_6px_20px_rgba(139,184,60,0.45)]',
    valueText: 'text-brand-green dark:text-brand-primary-400',
    linkIconColor: 'text-brand-green',
  },
  navy: {
    borderHover: 'hover:border-[#1B2E42] dark:hover:border-slate-400',
    borderActive: 'border-[#1B2E42] dark:border-slate-400 ring-2 ring-[#1B2E42]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(27,46,66,0.35)]',
    iconWrapper:
      'bg-[#1B2E42] text-white shadow-md shadow-[#1B2E42]/35 group-hover:shadow-[0_6px_20px_rgba(27,46,66,0.45)]',
    valueText: 'text-brand-navy dark:text-slate-100',
    linkIconColor: 'text-brand-navy dark:text-slate-300',
  },
  cyan: {
    borderHover: 'hover:border-[#2F6B87] dark:hover:border-brand-support-blue-light',
    borderActive: 'border-[#2F6B87] dark:border-brand-support-blue-light ring-2 ring-[#2F6B87]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(47,107,135,0.35)]',
    iconWrapper:
      'bg-[#2F6B87] text-white shadow-md shadow-[#2F6B87]/30 group-hover:shadow-[0_6px_20px_rgba(47,107,135,0.45)]',
    valueText: 'text-brand-support-blue dark:text-brand-support-blue-light',
    linkIconColor: 'text-brand-support-blue dark:text-brand-support-blue-light',
  },
  gold: {
    borderHover: 'hover:border-[#D6BA34]',
    borderActive: 'border-[#D6BA34] ring-2 ring-[#D6BA34]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(214,186,52,0.35)]',
    iconWrapper:
      'bg-[#D6BA34] text-white shadow-md shadow-[#D6BA34]/30 group-hover:shadow-[0_6px_20px_rgba(214,186,52,0.45)]',
    valueText: 'text-[#b49a28] dark:text-brand-yellow',
    linkIconColor: 'text-brand-yellow',
  },
  amber: {
    borderHover: 'hover:border-[#D6BA34]',
    borderActive: 'border-[#D6BA34] ring-2 ring-[#D6BA34]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(214,186,52,0.35)]',
    iconWrapper:
      'bg-[#D6BA34] text-white shadow-md shadow-[#D6BA34]/30 group-hover:shadow-[0_6px_20px_rgba(214,186,52,0.45)]',
    valueText: 'text-[#b49a28] dark:text-brand-yellow',
    linkIconColor: 'text-brand-yellow',
  },
  yellow: {
    borderHover: 'hover:border-[#D6BA34]',
    borderActive: 'border-[#D6BA34] ring-2 ring-[#D6BA34]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(214,186,52,0.35)]',
    iconWrapper:
      'bg-[#D6BA34] text-white shadow-md shadow-[#D6BA34]/30 group-hover:shadow-[0_6px_20px_rgba(214,186,52,0.45)]',
    valueText: 'text-[#b49a28] dark:text-brand-yellow',
    linkIconColor: 'text-brand-yellow',
  },
  emerald: {
    borderHover: 'hover:border-brand-green',
    borderActive: 'border-brand-green ring-2 ring-brand-green/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(139,184,60,0.35)]',
    iconWrapper:
      'bg-[#8BB83C] text-white shadow-md shadow-[#8BB83C]/30 group-hover:shadow-[0_6px_20px_rgba(139,184,60,0.45)]',
    valueText: 'text-brand-green dark:text-brand-primary-400',
    linkIconColor: 'text-brand-green',
  },
  blue: {
    borderHover: 'hover:border-[#2F6B87] dark:hover:border-brand-support-blue-light',
    borderActive: 'border-[#2F6B87] dark:border-brand-support-blue-light ring-2 ring-[#2F6B87]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(47,107,135,0.35)]',
    iconWrapper:
      'bg-[#2F6B87] text-white shadow-md shadow-[#2F6B87]/30 group-hover:shadow-[0_6px_20px_rgba(47,107,135,0.45)]',
    valueText: 'text-brand-support-blue dark:text-brand-support-blue-light',
    linkIconColor: 'text-brand-support-blue dark:text-brand-support-blue-light',
  },
  indigo: {
    borderHover: 'hover:border-[#1B2E42] dark:hover:border-slate-400',
    borderActive: 'border-[#1B2E42] dark:border-slate-400 ring-2 ring-[#1B2E42]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(27,46,66,0.35)]',
    iconWrapper:
      'bg-[#1B2E42] text-white shadow-md shadow-[#1B2E42]/35 group-hover:shadow-[0_6px_20px_rgba(27,46,66,0.45)]',
    valueText: 'text-brand-navy dark:text-slate-100',
    linkIconColor: 'text-brand-navy dark:text-slate-300',
  },
  purple: {
    borderHover: 'hover:border-[#2F6B87] dark:hover:border-brand-support-blue-light',
    borderActive: 'border-[#2F6B87] dark:border-brand-support-blue-light ring-2 ring-[#2F6B87]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(47,107,135,0.35)]',
    iconWrapper:
      'bg-[#2F6B87] text-white shadow-md shadow-[#2F6B87]/30 group-hover:shadow-[0_6px_20px_rgba(47,107,135,0.45)]',
    valueText: 'text-brand-support-blue dark:text-brand-support-blue-light',
    linkIconColor: 'text-brand-support-blue dark:text-brand-support-blue-light',
  },
  orange: {
    borderHover: 'hover:border-[#D6BA34]',
    borderActive: 'border-[#D6BA34] ring-2 ring-[#D6BA34]/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(214,186,52,0.35)]',
    iconWrapper:
      'bg-[#D6BA34] text-white shadow-md shadow-[#D6BA34]/30 group-hover:shadow-[0_6px_20px_rgba(214,186,52,0.45)]',
    valueText: 'text-[#b49a28] dark:text-brand-yellow',
    linkIconColor: 'text-brand-yellow',
  },
  rose: {
    borderHover: 'hover:border-rose-500 dark:hover:border-rose-400',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(239,68,68,0.35)]',
    iconWrapper:
      'bg-rose-500 text-white shadow-md shadow-rose-500/30 group-hover:shadow-[0_6px_20px_rgba(239,68,68,0.45)]',
    valueText: 'text-rose-600 dark:text-rose-400',
    linkIconColor: 'text-rose-500',
  },
  red: {
    borderHover: 'hover:border-rose-500 dark:hover:border-rose-400',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(239,68,68,0.35)]',
    iconWrapper:
      'bg-rose-500 text-white shadow-md shadow-rose-500/30 group-hover:shadow-[0_6px_20px_rgba(239,68,68,0.45)]',
    valueText: 'text-rose-600 dark:text-rose-400',
    linkIconColor: 'text-rose-500',
  },
};

const cardAccentStyles: Record<StatCardColor, { border: string; surface: string }> = {
  primary: { border: 'border-brand-green/50', surface: 'bg-gradient-to-b from-brand-green/[0.045] to-brand-bg-card dark:from-brand-green/[0.08] dark:to-brand-bg-card' },
  green: { border: 'border-brand-green/50', surface: 'bg-gradient-to-b from-brand-green/[0.045] to-brand-bg-card dark:from-brand-green/[0.08] dark:to-brand-bg-card' },
  navy: { border: 'border-brand-navy/45 dark:border-slate-700/60', surface: 'bg-gradient-to-b from-brand-navy/[0.04] to-brand-bg-card dark:from-white/[0.04] dark:to-brand-bg-card' },
  cyan: { border: 'border-brand-support-blue/45 dark:border-brand-support-blue-light/50', surface: 'bg-gradient-to-b from-brand-support-blue/[0.045] to-brand-bg-card dark:from-brand-support-blue/[0.08] dark:to-brand-bg-card' },
  gold: { border: 'border-brand-yellow/55', surface: 'bg-gradient-to-b from-brand-yellow/[0.055] to-brand-bg-card dark:from-brand-yellow/[0.08] dark:to-brand-bg-card' },
  amber: { border: 'border-brand-yellow/55', surface: 'bg-gradient-to-b from-brand-yellow/[0.055] to-brand-bg-card dark:from-brand-yellow/[0.08] dark:to-brand-bg-card' },
  yellow: { border: 'border-brand-yellow/55', surface: 'bg-gradient-to-b from-brand-yellow/[0.055] to-brand-bg-card dark:from-brand-yellow/[0.08] dark:to-brand-bg-card' },
  emerald: { border: 'border-brand-green/50', surface: 'bg-gradient-to-b from-brand-green/[0.045] to-brand-bg-card dark:from-brand-green/[0.08] dark:to-brand-bg-card' },
  blue: { border: 'border-brand-support-blue/45 dark:border-brand-support-blue-light/50', surface: 'bg-gradient-to-b from-brand-support-blue/[0.045] to-brand-bg-card dark:from-brand-support-blue/[0.08] dark:to-brand-bg-card' },
  indigo: { border: 'border-brand-navy/45 dark:border-slate-700/60', surface: 'bg-gradient-to-b from-brand-navy/[0.04] to-brand-bg-card dark:from-white/[0.04] dark:to-brand-bg-card' },
  purple: { border: 'border-brand-support-blue/45 dark:border-brand-support-blue-light/50', surface: 'bg-gradient-to-b from-brand-support-blue/[0.045] to-brand-bg-card dark:from-brand-support-blue/[0.08] dark:to-brand-bg-card' },
  orange: { border: 'border-brand-yellow/55', surface: 'bg-gradient-to-b from-brand-yellow/[0.055] to-brand-bg-card dark:from-brand-yellow/[0.08] dark:to-brand-bg-card' },
  rose: { border: 'border-rose-500/45', surface: 'bg-gradient-to-b from-rose-500/[0.04] to-brand-bg-card dark:from-rose-500/[0.08] dark:to-brand-bg-card' },
  red: { border: 'border-rose-500/45', surface: 'bg-gradient-to-b from-rose-500/[0.04] to-brand-bg-card dark:from-rose-500/[0.08] dark:to-brand-bg-card' },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'green',
  colorIndex,
  onClick,
  alert,
  alertLabel,
  className = '',
  hasLink = false,
  compact = false,
}) => {
  const effectiveColor: StatCardColor =
    colorIndex !== undefined
      ? STAT_CARD_BRAND_SEQUENCE[((colorIndex % 4) + 4) % 4]
      : color;

  const styles = colorStyles[effectiveColor] || colorStyles.green;
  const accent = cardAccentStyles[effectiveColor] || cardAccentStyles.green;
  const isClickable = Boolean(onClick || hasLink);

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-transparent transition-all duration-300 ease-out select-none',
        'hover:-translate-y-1 hover:shadow-lg',
        accent.surface,
        styles.shadowHover,
        'shadow-sm',
        isClickable ? 'cursor-pointer' : 'cursor-default',
        compact ? 'p-3 sm:p-3.5' : 'p-3.5 sm:p-4',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10.5px] sm:text-xs font-bold text-brand-text-muted uppercase tracking-wider block truncate">
              {title}
            </span>
            {alert && alertLabel && (
              <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-black rounded-md uppercase tracking-wider animate-pulse shrink-0">
                {alertLabel}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="m-0 text-xl sm:text-2xl font-black text-brand-text-primary font-mono tabular-nums tracking-tight transition-colors duration-200 block">
              {value}
            </span>
            {subtitle && (
              <span className="text-xs text-brand-text-secondary font-medium truncate">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Glowing Transforming Icon */}
        <div
          className={cn(
            compact
              ? 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl'
              : 'w-10.5 h-10.5 sm:w-11 sm:h-11 rounded-2xl',
            'flex items-center justify-center shrink-0 transition-all duration-300 ease-out group-hover:scale-105',
            styles.iconWrapper
          )}
        >
          <Icon
            size={compact ? 17 : 20}
            className="transition-transform duration-300 group-hover:scale-110"
          />
        </div>
      </div>
    </div>
  );
};

export default Card;
