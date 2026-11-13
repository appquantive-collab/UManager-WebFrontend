import { forwardRef, useState, type InputHTMLAttributes } from "react";
import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className, type, ...props }, ref) => {
    const inputId = id ?? props.name;
    const isPassword = type === "password";
    const [revealed, setRevealed] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-semibold text-text">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && revealed ? "text" : type}
            aria-invalid={error ? true : undefined}
            className={clsx(
              "w-full rounded-lg border bg-surface-variant px-3.5 py-2 text-sm text-text",
              "outline-none transition-colors placeholder:text-text-muted",
              error ? "border-danger" : "border-transparent focus:border-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isPassword && "pr-10",
              className
            )}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              tabIndex={-1}
              aria-label={revealed ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted outline-none transition-colors hover:text-text focus-visible:text-text"
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : null}
        </div>
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>
    );
  }
);

TextField.displayName = "TextField";
