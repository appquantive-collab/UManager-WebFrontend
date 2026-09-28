import { forwardRef, type InputHTMLAttributes } from "react";
import clsx from "clsx";

interface PhoneFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
}

export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-text-muted">
          {label}
        </label>
        <div
          className={clsx(
            "flex items-stretch overflow-hidden rounded-lg border bg-surface-variant",
            "transition-colors focus-within:border-primary",
            error ? "border-danger" : "border-transparent"
          )}
        >
          <span className="flex shrink-0 items-center gap-1.5 border-r border-border/60 px-3 text-sm font-medium text-text-muted">
            <span aria-hidden="true">🇮🇳</span>
            +91
          </span>
          <input
            ref={ref}
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            className={clsx(
              "min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-text outline-none",
              "placeholder:text-text-muted/70 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />
        </div>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
    );
  }
);

PhoneField.displayName = "PhoneField";
