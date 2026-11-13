import { useQuery } from "@tanstack/react-query";
import { getProfile, type AppFeatures } from "./auth-api";
import { ALL_FEATURES_ON } from "./business-templates";

/**
 * The business's chosen setup. Businesses that haven't picked one yet (or set
 * up before templates existed) see every feature, so nothing disappears.
 */
export function useAppSetup(): {
  features: AppFeatures;
  defaultBillType: "gst" | "record";
  template: string | null;
  /**
   * i18next `context` for wording that differs by business: "firm" for traders,
   * wholesalers and manufacturers who don't sell at a counter (no "galla",
   * "dukaan band karte waqt"); undefined keeps the shopkeeper wording.
   * Use as t(key, { context: vocab }) — keys fall back to the shop text when no
   * `key_firm` exists.
   */
  vocab: "firm" | undefined;
} {
  const { data } = useQuery({ queryKey: ["profile"], queryFn: getProfile, staleTime: 60_000 });
  const setup = data?.tenant?.appSetup;
  const saved = setup?.features ?? ALL_FEATURES_ON;
  // Rokad bahi is a shop routine: setups saved before it had its own switch follow counter sale.
  const features: AppFeatures = { ...saved, cashbook: saved.cashbook ?? saved.counterSale };
  return {
    features,
    defaultBillType: setup?.defaultBillType ?? "record",
    template: setup?.template ?? null,
    vocab: features.counterSale ? undefined : "firm",
  };
}
