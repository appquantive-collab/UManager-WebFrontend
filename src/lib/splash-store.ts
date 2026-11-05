import { create } from "zustand";

interface SplashState {
  // Lets screens that start animating on their own (the Munshi AI welcome chat)
  // wait until the splash overlay is gone instead of playing hidden behind it.
  done: boolean;
  finish: () => void;
  // Set by the splash's "Get started": the desktop landing page opens the
  // Munshi AI chat over itself only when the visitor asked for it.
  chatRequested: boolean;
  requestChat: () => void;
}

export const useSplashStore = create<SplashState>((set) => ({
  done: false,
  finish: () => set({ done: true }),
  chatRequested: false,
  requestChat: () => set({ chatRequested: true }),
}));
