import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  isLoading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover",
  secondary: "border border-primary/25 bg-primary-container text-primary-hover hover:bg-primary/10",
  ghost: "text-text-muted hover:bg-surface-muted hover:text-text",
  danger: "bg-danger text-white hover:bg-danger/90",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", isLoading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition-[color,background-color,transform] active:scale-[0.98]",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {isLoading ? "Please wait…" : children}
      </button>
    );
  }
);

Button.displayName = "Button";
