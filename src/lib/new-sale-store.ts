import { create } from "zustand";

interface NewSaleModalState {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export const useNewSaleModalStore = create<NewSaleModalState>((set) => ({
  open: false,
  openModal: () => set({ open: true }),
  closeModal: () => set({ open: false }),
}));
