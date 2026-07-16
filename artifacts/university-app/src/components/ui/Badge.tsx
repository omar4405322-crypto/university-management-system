import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // @replit
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate ",
  {
    variants: {
      variant: {
        default:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary:
          // @replit no hover because we use hover-elevate
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
          // @replit shadow-xs" - use badge outline variable
        outline: "text-foreground border [border-color:var(--badge-outline)]",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20",
        warning:
          "border-transparent bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20",
        danger:
          "border-transparent bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20",
        info:
          "border-transparent bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20",
        neutral:
          "border-transparent bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border-slate-500/20",
        primary:
          "border-transparent bg-brand-primary-500/10 text-brand-primary-600 dark:bg-brand-primary-500/20 dark:text-brand-primary-400 border-brand-primary-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

export default Badge;
