import { create } from "zustand";

interface NewOrderModalState {
  open: boolean;
  /** Opened from "Voice order": go straight to Munshi AI and start the mic. */
  voice: boolean;
  openModal: () => void;
  openVoice: () => void;
  closeModal: () => void;
}

export const useNewOrderModalStore = create<NewOrderModalState>((set) => ({
  open: false,
  voice: false,
  openModal: () => set({ open: true, voice: false }),
  openVoice: () => set({ open: true, voice: true }),
  closeModal: () => set({ open: false, voice: false }),
}));
