import { forwardRef, type InputHTMLAttributes } from "react";
import clsx from "clsx";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-text-muted">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "rounded-lg border bg-surface-variant px-3.5 py-2.5 text-sm text-text",
            "outline-none transition-colors placeholder:text-text-muted/70",
            error ? "border-danger" : "border-transparent focus:border-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
    );
  }
);

TextField.displayName = "TextField";
