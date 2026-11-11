import { create } from "zustand";

interface NewSaleModalState {
  open: boolean;
  /** Bill this customer straight away (e.g. "Make bill" on their order). */
  presetCustomerId: string | null;
  openModal: (customerId?: unknown) => void;
  closeModal: () => void;
}

export const useNewSaleModalStore = create<NewSaleModalState>((set) => ({
  open: false,
  presetCustomerId: null,
  // Also used directly as an onClick handler, so ignore anything that isn't a customer id (e.g. the click event).
  openModal: (customerId) => set({ open: true, presetCustomerId: typeof customerId === "string" ? customerId : null }),
  closeModal: () => set({ open: false, presetCustomerId: null }),
}));
