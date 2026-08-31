import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { noPadding?: boolean }
>(({ className, noPadding, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
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
  primary: {
    borderHover: 'hover:border-brand-primary-500 dark:hover:border-brand-primary-400',
    borderActive: 'border-brand-primary-500 ring-2 ring-brand-primary-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(132,189,58,0.3)]',
    iconWrapper:
      'bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 shadow-[0_0_16px_rgba(132,189,58,0.15)] group-hover:bg-brand-primary-500 group-hover:text-white dark:group-hover:bg-brand-primary-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(132,189,58,0.45)]',
    valueText: 'text-brand-primary-600 dark:text-brand-primary-400',
    linkIconColor: 'text-brand-primary-600 dark:text-brand-primary-400',
  },
  green: {
    borderHover: 'hover:border-emerald-500 dark:hover:border-emerald-400',
    borderActive: 'border-emerald-500 ring-2 ring-emerald-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(16,185,129,0.3)]',
    iconWrapper:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.15)] group-hover:bg-emerald-500 group-hover:text-white dark:group-hover:bg-emerald-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(16,185,129,0.45)]',
    valueText: 'text-emerald-600 dark:text-emerald-400',
    linkIconColor: 'text-emerald-500',
  },
  emerald: {
    borderHover: 'hover:border-emerald-500 dark:hover:border-emerald-400',
    borderActive: 'border-emerald-500 ring-2 ring-emerald-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(16,185,129,0.3)]',
    iconWrapper:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.15)] group-hover:bg-emerald-500 group-hover:text-white dark:group-hover:bg-emerald-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(16,185,129,0.45)]',
    valueText: 'text-emerald-600 dark:text-emerald-400',
    linkIconColor: 'text-emerald-500',
  },
  blue: {
    borderHover: 'hover:border-blue-500 dark:hover:border-blue-400',
    borderActive: 'border-blue-500 ring-2 ring-blue-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(59,130,246,0.3)]',
    iconWrapper:
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.15)] group-hover:bg-blue-500 group-hover:text-white dark:group-hover:bg-blue-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(59,130,246,0.45)]',
    valueText: 'text-blue-600 dark:text-blue-400',
    linkIconColor: 'text-blue-500',
  },
  indigo: {
    borderHover: 'hover:border-blue-600 dark:hover:border-blue-400',
    borderActive: 'border-blue-600 ring-2 ring-blue-600/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(37,99,235,0.3)]',
    iconWrapper:
      'bg-blue-600/10 text-blue-700 dark:text-blue-400 shadow-[0_0_16px_rgba(37,99,235,0.15)] group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(37,99,235,0.45)]',
    valueText: 'text-blue-700 dark:text-blue-400',
    linkIconColor: 'text-blue-600',
  },
  purple: {
    borderHover: 'hover:border-brand-primary-500 dark:hover:border-brand-primary-400',
    borderActive: 'border-brand-primary-500 ring-2 ring-brand-primary-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(132,189,58,0.3)]',
    iconWrapper:
      'bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 shadow-[0_0_16px_rgba(132,189,58,0.15)] group-hover:bg-brand-primary-500 group-hover:text-white dark:group-hover:bg-brand-primary-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(132,189,58,0.45)]',
    valueText: 'text-brand-primary-600 dark:text-brand-primary-400',
    linkIconColor: 'text-brand-primary-600',
  },
  amber: {
    borderHover: 'hover:border-amber-500 dark:hover:border-amber-400',
    borderActive: 'border-amber-500 ring-2 ring-amber-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(245,158,11,0.3)]',
    iconWrapper:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.15)] group-hover:bg-amber-500 group-hover:text-white dark:group-hover:bg-amber-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(245,158,11,0.45)]',
    valueText: 'text-amber-600 dark:text-amber-400',
    linkIconColor: 'text-amber-500',
  },
  yellow: {
    borderHover: 'hover:border-amber-500 dark:hover:border-amber-400',
    borderActive: 'border-amber-500 ring-2 ring-amber-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(245,158,11,0.3)]',
    iconWrapper:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.15)] group-hover:bg-amber-500 group-hover:text-white dark:group-hover:bg-amber-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(245,158,11,0.45)]',
    valueText: 'text-amber-600 dark:text-amber-400',
    linkIconColor: 'text-amber-500',
  },
  orange: {
    borderHover: 'hover:border-amber-600 dark:hover:border-amber-400',
    borderActive: 'border-amber-600 ring-2 ring-amber-600/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(217,119,6,0.3)]',
    iconWrapper:
      'bg-amber-600/10 text-amber-600 dark:text-amber-400 shadow-[0_0_16px_rgba(217,119,6,0.15)] group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-600 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(217,119,6,0.45)]',
    valueText: 'text-amber-600 dark:text-amber-400',
    linkIconColor: 'text-amber-600',
  },
  rose: {
    borderHover: 'hover:border-rose-500 dark:hover:border-rose-400',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(239,68,68,0.3)]',
    iconWrapper:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-[0_0_16px_rgba(239,68,68,0.15)] group-hover:bg-rose-500 group-hover:text-white dark:group-hover:bg-rose-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(239,68,68,0.45)]',
    valueText: 'text-rose-600 dark:text-rose-400',
    linkIconColor: 'text-rose-500',
  },
  red: {
    borderHover: 'hover:border-rose-500 dark:hover:border-rose-400',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(239,68,68,0.3)]',
    iconWrapper:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-[0_0_16px_rgba(239,68,68,0.15)] group-hover:bg-rose-500 group-hover:text-white dark:group-hover:bg-rose-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(239,68,68,0.45)]',
    valueText: 'text-rose-600 dark:text-rose-400',
    linkIconColor: 'text-rose-500',
  },
  cyan: {
    borderHover: 'hover:border-blue-500 dark:hover:border-blue-400',
    borderActive: 'border-blue-500 ring-2 ring-blue-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(59,130,246,0.3)]',
    iconWrapper:
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.15)] group-hover:bg-blue-500 group-hover:text-white dark:group-hover:bg-blue-500 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(59,130,246,0.45)]',
    valueText: 'text-blue-600 dark:text-blue-400',
    linkIconColor: 'text-blue-500',
  },
  navy: {
    borderHover: 'hover:border-brand-navy-500 dark:hover:border-slate-400',
    borderActive: 'border-brand-navy-500 dark:border-slate-400 ring-2 ring-brand-navy-500/20',
    shadowHover: 'hover:shadow-[0_10px_25px_-5px_rgba(20,38,50,0.3)]',
    iconWrapper:
      'bg-slate-100 text-brand-navy-500 dark:bg-slate-700 dark:text-slate-200 shadow-[0_0_16px_rgba(30,41,59,0.15)] group-hover:bg-brand-navy-500 group-hover:text-white dark:group-hover:bg-slate-600 dark:group-hover:text-white group-hover:shadow-[0_4px_20px_rgba(30,41,59,0.45)]',
    valueText: 'text-slate-900 dark:text-white',
    linkIconColor: 'text-brand-navy-500 dark:text-slate-400',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
  onClick,
  isActive = false,
  alert,
  alertLabel,
  className = '',
  hasLink = false,
  compact = false,
}) => {
  const styles = colorStyles[color] || colorStyles.primary;
  const isClickable = Boolean(onClick || hasLink);

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      className={cn(
        'group relative rounded-2xl bg-white dark:bg-slate-800 border transition-all duration-300 ease-out select-none',
        'hover:-translate-y-1.5 hover:shadow-lg',
        styles.borderHover,
        styles.shadowHover,
        isActive
          ? styles.borderActive
          : 'border-slate-200/90 dark:border-slate-700/80 shadow-xs',
        isClickable ? 'cursor-pointer' : 'cursor-default',
        compact ? 'p-3 sm:p-3.5' : 'p-3.5 sm:p-4',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10.5px] sm:text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block truncate">
              {title}
            </span>
            {alert && alertLabel && (
              <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-black rounded-md uppercase tracking-wider animate-pulse shrink-0">
                {alertLabel}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight transition-colors duration-200">
              {value}
            </h3>
            {subtitle && (
              <span className="text-xs text-slate-400 dark:text-slate-400 font-medium truncate">
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
