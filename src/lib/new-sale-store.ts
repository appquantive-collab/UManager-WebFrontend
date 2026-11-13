import { create } from "zustand";
import type { BillType } from "./invoices-api";

interface NewSaleModalState {
  open: boolean;
  /** Bill this customer straight away (e.g. "Make bill" on their order). */
  presetCustomerId: string | null;
  /** Start on this bill type (e.g. the dashboard's "GST bill" tile). */
  presetBillType: BillType | null;
  openModal: (customerId?: unknown) => void;
  openGstBill: () => void;
  closeModal: () => void;
}

export const useNewSaleModalStore = create<NewSaleModalState>((set) => ({
  open: false,
  presetCustomerId: null,
  presetBillType: null,
  // Also used directly as an onClick handler, so ignore anything that isn't a customer id (e.g. the click event).
  openModal: (customerId) =>
    set({ open: true, presetCustomerId: typeof customerId === "string" ? customerId : null, presetBillType: null }),
  openGstBill: () => set({ open: true, presetCustomerId: null, presetBillType: "gst" }),
  closeModal: () => set({ open: false, presetCustomerId: null, presetBillType: null }),
}));
