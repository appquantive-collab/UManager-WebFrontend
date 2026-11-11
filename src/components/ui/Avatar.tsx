import { User } from "lucide-react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface AvatarProps {
  name: string;
  size?: number;
  variant?: "initials" | "neutral";
}

export function Avatar({ name, size = 44, variant = "initials" }: AvatarProps) {
  if (variant === "neutral") {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border border-border text-icon"
        style={{ width: size, height: size }}
      >
        <User size={size * 0.5} strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-border font-semibold text-text-muted"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}
