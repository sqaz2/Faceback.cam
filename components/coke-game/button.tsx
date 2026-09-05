import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[transform,background-color,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-coke text-foam hover:bg-coke-dark shadow-[0_2px_0_0_var(--color-coke-deep)]",
        cream: "bg-cream text-ink hover:bg-cream-dim",
        ghost: "bg-transparent text-cream hover:bg-foam/10",
        ink: "bg-ink-soft text-cream border border-border hover:bg-ink-mid",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-[10px]",
        md: "h-11 px-4 text-sm rounded-[12px]",
        lg: "h-12 px-6 text-base rounded-[14px]",
        icon: "size-11 rounded-[12px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
