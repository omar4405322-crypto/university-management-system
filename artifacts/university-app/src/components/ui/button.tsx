import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border text-sm font-bold transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg-page disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "border-brand-primary-600 bg-brand-primary-600 text-white shadow-sm shadow-brand-primary-600/20 hover:border-brand-primary-700 hover:bg-brand-primary-700 hover:shadow-md hover:shadow-brand-primary-600/25",
        primary: "btn-primary",
        destructive:
          "border-error-strong bg-error-strong text-white shadow-sm shadow-error-strong/20 hover:opacity-90",
        outline:
          "border-brand-border bg-brand-bg-card text-brand-text-primary shadow-sm hover:border-brand-primary-500/60 hover:bg-brand-primary-50 hover:text-brand-primary-700 dark:hover:bg-brand-primary-950/25 dark:hover:text-brand-primary-300",
        secondary:
          "border-brand-navy-500 bg-brand-navy-500 text-white shadow-sm hover:bg-brand-navy-600",
        ghost:
          "border-transparent bg-transparent text-brand-text-secondary hover:bg-surface-subtle hover:text-brand-text-primary",
        link: "border-transparent bg-transparent p-0 text-brand-primary-600 shadow-none underline-offset-4 hover:text-brand-primary-700 hover:underline",
      },
      size: {
        // @replit changed sizes
        default: "min-h-10 px-4 py-2",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-11 px-6",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
export default Button;
