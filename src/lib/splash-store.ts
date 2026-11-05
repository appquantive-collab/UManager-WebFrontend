import { create } from "zustand";

// Lets screens that start animating on their own (the Munshi AI welcome chat)
// wait until the splash overlay is gone instead of playing hidden behind it.
export const useSplashStore = create<{ done: boolean; finish: () => void }>((set) => ({
  done: false,
  finish: () => set({ done: true }),
}));
