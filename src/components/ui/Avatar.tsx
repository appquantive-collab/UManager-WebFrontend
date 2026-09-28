import { User } from "lucide-react";

const avatarColors = ["#6c47ff", "#12946a", "#2563eb", "#b5720a", "#d5352f", "#0891b2"];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

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
        className="flex shrink-0 items-center justify-center rounded-full bg-surface-variant text-text-muted"
        style={{ width: size, height: size }}
      >
        <User size={size * 0.5} strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ backgroundColor: colorForName(name), width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}
