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
    className={cn("font-semibold leading-none tracking-tight", className)}
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
  | 'cyan';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string | React.ReactNode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: StatCardColor;
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
   * Metric cards consume the four logo colors before any supporting shade.
   * Legacy variant names remain for compatibility, but each resolves to a
   * documented identity role: green, navy, yellow, or gray.
   */
  primary: {
    borderHover: 'hover:border-brand-green',
    borderActive: 'border-brand-green ring-2 ring-brand-green/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(139,184,60,0.3)]',
    iconWrapper:
      'bg-brand-green/10 text-brand-green shadow-[0_0_16px_rgba(139,184,60,0.15)] group-hover:shadow-[0_4px_20px_rgba(139,184,60,0.28)]',
    valueText: 'text-brand-green',
    linkIconColor: 'text-brand-green',
  },
  green: {
    borderHover: 'hover:border-brand-green',
    borderActive: 'border-brand-green ring-2 ring-brand-green/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(139,184,60,0.3)]',
    iconWrapper:
      'bg-brand-green/10 text-brand-green shadow-[0_0_16px_rgba(139,184,60,0.15)] group-hover:shadow-[0_4px_20px_rgba(139,184,60,0.28)]',
    valueText: 'text-brand-green',
    linkIconColor: 'text-brand-green',
  },
  emerald: {
    borderHover: 'hover:border-brand-navy dark:hover:border-brand-navy-200',
    borderActive: 'border-brand-navy dark:border-brand-navy-200 ring-2 ring-brand-navy/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(19,34,49,0.3)]',
    iconWrapper:
      'bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-100/10 dark:text-brand-navy-200 shadow-[0_0_16px_rgba(19,34,49,0.15)] group-hover:shadow-[0_4px_20px_rgba(19,34,49,0.28)]',
    valueText: 'text-brand-navy dark:text-brand-navy-200',
    linkIconColor: 'text-brand-navy dark:text-brand-navy-200',
  },
  blue: {
    borderHover: 'hover:border-brand-support-blue dark:hover:border-brand-support-blue-light',
    borderActive: 'border-brand-support-blue dark:border-brand-support-blue-light ring-2 ring-brand-support-blue/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(47,107,135,0.3)]',
    iconWrapper:
      'bg-brand-support-blue/10 text-brand-support-blue dark:bg-brand-support-blue-light/10 dark:text-brand-support-blue-light shadow-[0_0_16px_rgba(47,107,135,0.15)] group-hover:shadow-[0_4px_20px_rgba(47,107,135,0.28)]',
    valueText: 'text-brand-support-blue dark:text-brand-support-blue-light',
    linkIconColor: 'text-brand-support-blue dark:text-brand-support-blue-light',
  },
  indigo: {
    borderHover: 'hover:border-brand-navy dark:hover:border-brand-navy-200',
    borderActive: 'border-brand-navy dark:border-brand-navy-200 ring-2 ring-brand-navy/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(19,34,49,0.3)]',
    iconWrapper:
      'bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-100/10 dark:text-brand-navy-200 shadow-[0_0_16px_rgba(19,34,49,0.15)] group-hover:shadow-[0_4px_20px_rgba(19,34,49,0.28)]',
    valueText: 'text-brand-navy dark:text-brand-navy-200',
    linkIconColor: 'text-brand-navy dark:text-brand-navy-200',
  },
  purple: {
    borderHover: 'hover:border-brand-support-blue dark:hover:border-brand-support-blue-light',
    borderActive: 'border-brand-support-blue dark:border-brand-support-blue-light ring-2 ring-brand-support-blue/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(47,107,135,0.3)]',
    iconWrapper:
      'bg-brand-support-blue/10 text-brand-support-blue dark:bg-brand-support-blue-light/10 dark:text-brand-support-blue-light shadow-[0_0_16px_rgba(47,107,135,0.15)] group-hover:shadow-[0_4px_20px_rgba(47,107,135,0.28)]',
    valueText: 'text-brand-support-blue dark:text-brand-support-blue-light',
    linkIconColor: 'text-brand-support-blue dark:text-brand-support-blue-light',
  },
  amber: {
    borderHover: 'hover:border-brand-yellow',
    borderActive: 'border-brand-yellow ring-2 ring-brand-yellow/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(214,186,52,0.3)]',
    iconWrapper:
      'bg-brand-yellow/10 text-brand-yellow shadow-[0_0_16px_rgba(214,186,52,0.15)] group-hover:shadow-[0_4px_20px_rgba(214,186,52,0.28)]',
    valueText: 'text-brand-yellow',
    linkIconColor: 'text-brand-yellow',
  },
  yellow: {
    borderHover: 'hover:border-brand-yellow',
    borderActive: 'border-brand-yellow ring-2 ring-brand-yellow/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(214,186,52,0.3)]',
    iconWrapper:
      'bg-brand-yellow/10 text-brand-yellow shadow-[0_0_16px_rgba(214,186,52,0.15)] group-hover:shadow-[0_4px_20px_rgba(214,186,52,0.28)]',
    valueText: 'text-brand-yellow',
    linkIconColor: 'text-brand-yellow',
  },
  orange: {
    borderHover: 'hover:border-amber-600 dark:hover:border-amber-400',
    borderActive: 'border-amber-600 ring-2 ring-amber-600/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(180,154,40,0.3)]',
    iconWrapper:
      'bg-amber-600/10 text-amber-600 dark:text-amber-400 shadow-[0_0_16px_rgba(180,154,40,0.15)] group-hover:shadow-[0_4px_20px_rgba(180,154,40,0.28)]',
    valueText: 'text-amber-600 dark:text-amber-400',
    linkIconColor: 'text-amber-600',
  },
  rose: {
    borderHover: 'hover:border-rose-500 dark:hover:border-rose-400',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(239,68,68,0.3)]',
    iconWrapper:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-[0_0_16px_rgba(239,68,68,0.15)] group-hover:shadow-[0_4px_20px_rgba(239,68,68,0.28)]',
    valueText: 'text-rose-600 dark:text-rose-400',
    linkIconColor: 'text-rose-500',
  },
  red: {
    borderHover: 'hover:border-rose-500 dark:hover:border-rose-400',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(239,68,68,0.3)]',
    iconWrapper:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-[0_0_16px_rgba(239,68,68,0.15)] group-hover:shadow-[0_4px_20px_rgba(239,68,68,0.28)]',
    valueText: 'text-rose-600 dark:text-rose-400',
    linkIconColor: 'text-rose-500',
  },
  cyan: {
    borderHover: 'hover:border-blue-500 dark:hover:border-blue-400',
    borderActive: 'border-blue-500 ring-2 ring-blue-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(71,85,105,0.3)]',
    iconWrapper:
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-[0_0_16px_rgba(71,85,105,0.15)] group-hover:shadow-[0_4px_20px_rgba(71,85,105,0.28)]',
    valueText: 'text-blue-600 dark:text-blue-400',
    linkIconColor: 'text-blue-500',
  },
  navy: {
    borderHover: 'hover:border-brand-navy-500 dark:hover:border-slate-400',
    borderActive: 'border-brand-navy-500 dark:border-slate-400 ring-2 ring-brand-navy-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(19,34,49,0.3)]',
    iconWrapper:
      'bg-brand-navy/10 text-brand-navy dark:bg-brand-navy-100/10 dark:text-brand-navy-200 shadow-[0_0_16px_rgba(19,34,49,0.15)] group-hover:shadow-[0_4px_20px_rgba(19,34,49,0.28)]',
    valueText: 'text-slate-900 dark:text-white',
    linkIconColor: 'text-brand-navy-500 dark:text-slate-400',
  },
};

const cardAccentStyles: Record<StatCardColor, { border: string; surface: string }> = {
  primary: { border: 'border-brand-green/50', surface: 'bg-gradient-to-b from-brand-green/[0.045] to-brand-bg-card' },
  green: { border: 'border-brand-green/50', surface: 'bg-gradient-to-b from-brand-green/[0.045] to-brand-bg-card' },
  emerald: { border: 'border-brand-navy/45 dark:border-brand-navy-200/45', surface: 'bg-gradient-to-b from-brand-navy/[0.035] to-brand-bg-card dark:from-white/[0.035]' },
  blue: { border: 'border-brand-support-blue/45 dark:border-brand-support-blue-light/50', surface: 'bg-gradient-to-b from-brand-support-blue/[0.04] to-brand-bg-card' },
  indigo: { border: 'border-brand-navy/45 dark:border-brand-navy-200/45', surface: 'bg-gradient-to-b from-brand-navy/[0.035] to-brand-bg-card dark:from-white/[0.035]' },
  purple: { border: 'border-brand-support-blue/45 dark:border-brand-support-blue-light/50', surface: 'bg-gradient-to-b from-brand-support-blue/[0.04] to-brand-bg-card' },
  amber: { border: 'border-brand-yellow/55', surface: 'bg-gradient-to-b from-brand-yellow/[0.055] to-brand-bg-card' },
  yellow: { border: 'border-brand-yellow/55', surface: 'bg-gradient-to-b from-brand-yellow/[0.055] to-brand-bg-card' },
  orange: { border: 'border-brand-yellow/55', surface: 'bg-gradient-to-b from-brand-yellow/[0.055] to-brand-bg-card' },
  rose: { border: 'border-rose-500/45', surface: 'bg-gradient-to-b from-rose-500/[0.04] to-brand-bg-card' },
  red: { border: 'border-rose-500/45', surface: 'bg-gradient-to-b from-rose-500/[0.04] to-brand-bg-card' },
  navy: { border: 'border-brand-navy/45 dark:border-brand-navy-200/45', surface: 'bg-gradient-to-b from-brand-navy/[0.035] to-brand-bg-card dark:from-white/[0.035]' },
  cyan: { border: 'border-brand-support-blue/45 dark:border-brand-support-blue-light/50', surface: 'bg-gradient-to-b from-brand-support-blue/[0.04] to-brand-bg-card' },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
  onClick,
  alert,
  alertLabel,
  className = '',
  hasLink = false,
  compact = false,
}) => {
  const styles = colorStyles[color] || colorStyles.primary;
  const accent = cardAccentStyles[color] || cardAccentStyles.primary;
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
            <span className="m-0 text-xl sm:text-2xl font-black text-brand-text-primary font-mono tracking-tight transition-colors duration-200 block">
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
