import { create } from "zustand";

interface NewOrderModalState {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export const useNewOrderModalStore = create<NewOrderModalState>((set) => ({
  open: false,
  openModal: () => set({ open: true }),
  closeModal: () => set({ open: false }),
}));
