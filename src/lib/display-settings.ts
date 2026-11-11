import { create } from "zustand";

// Per-device display preferences. Text size changes the root font size, which
// every rem-based size and spacing in the app follows (text, buttons, cards);
// layout density tightens the shared spacing scale. Icons follow via CSS
// (index.css). Applied before the first render, so the app never jumps size.

export type TextSize = "small" | "medium" | "large" | "xlarge";
export type Density = "compact" | "comfortable";
export type DisplayPreset = "modern" | "standard" | "easy";

interface DisplayPrefs {
  textSize: TextSize;
  density: Density;
}

const STORAGE_KEY = "sethsathi.display";
const DEFAULTS: DisplayPrefs = { textSize: "medium", density: "comfortable" };

export const PRESETS: Record<DisplayPreset, DisplayPrefs> = {
  modern: { textSize: "small", density: "compact" },
  standard: { textSize: "medium", density: "comfortable" },
  easy: { textSize: "large", density: "comfortable" },
};

const TEXT_SIZES: TextSize[] = ["small", "medium", "large", "xlarge"];
const DENSITIES: Density[] = ["compact", "comfortable"];

function readPrefs(): DisplayPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<DisplayPrefs>;
    return {
      textSize: TEXT_SIZES.includes(saved.textSize as TextSize) ? (saved.textSize as TextSize) : DEFAULTS.textSize,
      density: DENSITIES.includes(saved.density as Density) ? (saved.density as Density) : DEFAULTS.density,
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(prefs: DisplayPrefs) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.textSize = prefs.textSize;
  document.documentElement.dataset.density = prefs.density;
}

function save(prefs: DisplayPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}

interface DisplayState extends DisplayPrefs {
  setTextSize: (textSize: TextSize) => void;
  setDensity: (density: Density) => void;
  applyPreset: (preset: DisplayPreset) => void;
}

const initial = readPrefs();
apply(initial);

export const useDisplayStore = create<DisplayState>((set, get) => {
  const update = (patch: Partial<DisplayPrefs>) => {
    const next = { textSize: get().textSize, density: get().density, ...patch };
    apply(next);
    save(next);
    set(next);
  };
  return {
    ...initial,
    setTextSize: (textSize) => update({ textSize }),
    setDensity: (density) => update({ density }),
    applyPreset: (preset) => update(PRESETS[preset]),
  };
});

/** Which preset the current choice matches, if any (for highlighting it). */
export function matchingPreset(prefs: DisplayPrefs): DisplayPreset | null {
  const match = (Object.keys(PRESETS) as DisplayPreset[]).find(
    (key) => PRESETS[key].textSize === prefs.textSize && PRESETS[key].density === prefs.density
  );
  return match ?? null;
}
