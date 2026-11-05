import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Bike,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  Coffee,
  Cookie,
  CreditCard,
  Dog,
  Flame,
  FlaskConical,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Grid3x3,
  HardHat,
  Landmark,
  Layers,
  Loader2,
  Milk,
  Monitor,
  Music,
  Nut,
  Package,
  PackageOpen,
  Pill,
  Printer,
  Recycle,
  Scissors,
  ShoppingBag,
  ShowerHead,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  SprayCan,
  Sprout,
  Trophy,
  UtensilsCrossed,
  Users,
  Warehouse,
  Watch,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { saveOnboarding, personalizeDashboard } from "../../lib/tenants-api";
import type { BusinessCategory, BusinessGoal, CustomerType, OrderVolume } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import { categoryLabel, customerTypeLabel, goalLabel, orderVolumeLabel } from "../../lib/onboarding-labels";

interface CategoryOption {
  value: BusinessCategory;
  icon: typeof Package;
}

const categoryGroups: { labelKey: string; items: CategoryOption[] }[] = [
  {
    labelKey: "onboarding.step1.groups.foodFmcgGrocery",
    items: [
      { value: "fmcg", icon: Package },
      { value: "grocery", icon: Building2 },
      { value: "confectionery_bakery", icon: Cookie },
      { value: "dry_fruits_spices", icon: Nut },
      { value: "tea_coffee", icon: Coffee },
      { value: "dairy_products", icon: Milk },
      { value: "agro_seeds_fertilizers", icon: Sprout },
      { value: "cattle_feed", icon: Dog },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.fashionTextiles",
    items: [
      { value: "apparel", icon: Shirt },
      { value: "readymade_garments", icon: ShoppingBag },
      { value: "saree_ethnic_wear", icon: Flower2 },
      { value: "textiles_fabric", icon: Scissors },
      { value: "footwear", icon: Footprints },
      { value: "bags_luggage", icon: Briefcase },
      { value: "watches_eyewear", icon: Watch },
      { value: "jewellery_artificial", icon: Gem },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.electronicsIt",
    items: [
      { value: "electronics", icon: Boxes },
      { value: "mobile_accessories", icon: Smartphone },
      { value: "computer_it", icon: Monitor },
      { value: "electrical_goods", icon: Zap },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.hardwareHomeBuilding",
    items: [
      { value: "hardware", icon: Warehouse },
      { value: "sanitary_plumbing", icon: ShowerHead },
      { value: "paints_chemicals", icon: FlaskConical },
      { value: "building_materials", icon: HardHat },
      { value: "tiles_sanitaryware", icon: Grid3x3 },
      { value: "glass_hardware", icon: Layers },
      { value: "furniture", icon: Sofa },
      { value: "kitchenware_utensils", icon: UtensilsCrossed },
      { value: "plastic_goods", icon: Recycle },
      { value: "cleaning_supplies", icon: SprayCan },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.autoTransport",
    items: [
      { value: "auto_parts", icon: Wrench },
      { value: "two_wheeler_parts", icon: Bike },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.healthBeauty",
    items: [
      { value: "pharma", icon: Pill },
      { value: "cosmetics_beauty", icon: Sparkles },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.stationeryGiftsLeisure",
    items: [
      { value: "stationery_books", icon: BookOpen },
      { value: "printing_stationery", icon: Printer },
      { value: "gift_items", icon: Gift },
      { value: "toys_games", icon: Gamepad2 },
      { value: "sports_goods", icon: Trophy },
      { value: "musical_instruments", icon: Music },
      { value: "packaging_materials", icon: PackageOpen },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.other",
    items: [
      { value: "fireworks", icon: Flame },
      { value: "religious_puja_items", icon: Landmark },
      { value: "other", icon: Sparkles },
    ],
  },
];

const customerTypes: { value: CustomerType }[] = [{ value: "wholesale" }, { value: "retail" }, { value: "both" }];

const orderVolumes: { value: OrderVolume }[] = [
  { value: "lt_100" },
  { value: "100_500" },
  { value: "500_2000" },
  { value: "gt_2000" },
];

const goalOptions: { value: BusinessGoal; icon: typeof Boxes }[] = [
  { value: "inventory_tracking", icon: Boxes },
  { value: "credit_payments", icon: CreditCard },
  { value: "multi_warehouse", icon: Warehouse },
  { value: "staff_management", icon: Users },
  { value: "ai_insights", icon: Sparkles },
  { value: "reporting", icon: Building2 },
];

const MAX_GOALS = 3;

type Step = 1 | 2 | 3 | "generating" | "done";

export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<BusinessCategory | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType | null>(null);
  const [orderVolume, setOrderVolume] = useState<OrderVolume | null>(null);
  const [warehouseCount, setWarehouseCount] = useState("1");
  const [staffCount, setStaffCount] = useState("1");
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [painPoints, setPainPoints] = useState("");

  const saveMutation = useMutation({ mutationFn: saveOnboarding });
  const personalizeMutation = useMutation({ mutationFn: personalizeDashboard });

  if (!open) return null;

  const toggleGoal = (goal: BusinessGoal) => {
    setGoals((current) => {
      if (current.includes(goal)) return current.filter((g) => g !== goal);
      if (current.length >= MAX_GOALS) return current;
      return [...current, goal];
    });
  };

  const canContinueStep1 = category !== null && customerType !== null;
  const canContinueStep2 = orderVolume !== null && warehouseCount !== "" && staffCount !== "";
  const canSubmit = goals.length > 0;

  const handleSubmit = async () => {
    if (!category || !customerType || !orderVolume) return;
    setStep("generating");

    try {
      await saveMutation.mutateAsync({
        category,
        customerType,
        orderVolume,
        warehouseCount: Number(warehouseCount) || 0,
        staffCount: Number(staffCount) || 0,
        painPoints: painPoints.trim() || undefined,
        goals,
      });

      try {
        await personalizeMutation.mutateAsync();
      } catch {
        // AI personalization is best-effort (needs GEMINI_API_KEY configured server-side).
        // Onboarding itself already succeeded, so we don't block or fail the flow on this.
      }

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setStep("done");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("onboarding.genericError"));
      setStep(3);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex w-full max-w-md max-h-[90vh] flex-col rounded-2xl bg-surface shadow-elevation-3">
        {step !== "generating" && step !== "done" && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("onboarding.skipForNow")}
            className="absolute right-4 top-4 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <>
              <h2 className="text-lg font-bold text-text">{t("onboarding.step1.heading")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("onboarding.step1.subheading")}</p>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-muted">{t("onboarding.step1.categoryLabel")}</p>
                <div className="flex flex-col gap-4">
                  {categoryGroups.map((group) => (
                    <div key={group.labelKey}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted/70">
                        {t(group.labelKey)}
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {group.items.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setCategory(c.value)}
                            className={clsx(
                              "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 outline-none transition-colors",
                              "focus-visible:ring-2 focus-visible:ring-primary/40",
                              category === c.value
                                ? "border-primary bg-primary-container text-primary"
                                : "border-border text-text-muted hover:border-primary/30"
                            )}
                          >
                            <c.icon size={18} className="shrink-0" />
                            <span className="text-center text-[10.5px] font-medium leading-tight">
                              {categoryLabel(c.value)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-muted">{t("onboarding.step1.customersLabel")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {customerTypes.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCustomerType(c.value)}
                      className={clsx(
                        "rounded-xl border px-3 py-2.5 text-sm font-medium outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-primary/40",
                        customerType === c.value
                          ? "border-primary bg-primary-container text-primary"
                          : "border-border text-text-muted hover:border-primary/30"
                      )}
                    >
                      {customerTypeLabel(c.value)}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="mt-6 w-full" disabled={!canContinueStep1} onClick={() => setStep(2)}>
                {t("onboarding.continue")}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-bold text-text">{t("onboarding.step2.heading")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("onboarding.step2.subheading")}</p>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-muted">{t("onboarding.step2.orderVolumeLabel")}</p>
                <div className="grid grid-cols-4 gap-2">
                  {orderVolumes.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => setOrderVolume(v.value)}
                      className={clsx(
                        "rounded-xl border px-2 py-2.5 text-center text-xs font-semibold outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-primary/40",
                        orderVolume === v.value
                          ? "border-primary bg-primary-container text-primary"
                          : "border-border text-text-muted hover:border-primary/30"
                      )}
                    >
                      {orderVolumeLabel(v.value)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <TextField
                  label={t("onboarding.step2.warehouses")}
                  type="number"
                  min={0}
                  value={warehouseCount}
                  onChange={(e) => setWarehouseCount(e.target.value)}
                />
                <TextField
                  label={t("onboarding.step2.staffMembers")}
                  type="number"
                  min={0}
                  value={staffCount}
                  onChange={(e) => setStaffCount(e.target.value)}
                />
              </div>

              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                  {t("onboarding.back")}
                </Button>
                <Button className="flex-1" disabled={!canContinueStep2} onClick={() => setStep(3)}>
                  {t("onboarding.continue")}
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-bold text-text">{t("onboarding.step3.heading")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("onboarding.step3.subheading", { max: MAX_GOALS })}</p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {goalOptions.map((g) => {
                  const selected = goals.includes(g.value);
                  const disabled = !selected && goals.length >= MAX_GOALS;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleGoal(g.value)}
                      className={clsx(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-primary/40",
                        selected
                          ? "border-primary bg-primary-container text-primary"
                          : "border-border text-text-muted hover:border-primary/30",
                        disabled && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <g.icon size={16} className="shrink-0" />
                      <span className="leading-tight">{goalLabel(g.value)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5">
                <label className="mb-1.5 block text-sm font-medium text-text-muted" htmlFor="painPoints">
                  {t("onboarding.step3.painPointsLabel")}
                </label>
                <textarea
                  id="painPoints"
                  value={painPoints}
                  onChange={(e) => setPainPoints(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={t("onboarding.step3.painPointsPlaceholder")}
                  className="w-full resize-none rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                  {t("onboarding.back")}
                </Button>
                <Button className="flex-1" disabled={!canSubmit} onClick={handleSubmit}>
                  {t("onboarding.step3.finishSetup")}
                </Button>
              </div>
            </>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center py-6 text-center">
              <Loader2 size={32} className="animate-spin text-primary" />
              <h2 className="mt-4 text-lg font-bold text-text">{t("onboarding.generating.heading")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("onboarding.generating.subheading")}</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-container text-success">
                <Sparkles size={26} />
              </span>
              <h2 className="mt-4 text-lg font-bold text-text">{t("onboarding.done.heading")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("onboarding.done.subheading")}</p>
              <Button className="mt-5 w-full" onClick={onClose}>
                {t("onboarding.done.goToDashboard")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
