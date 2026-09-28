import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Boxes,
  Building2,
  CreditCard,
  Loader2,
  Package,
  Pill,
  Shirt,
  Sparkles,
  Users,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { saveOnboarding, personalizeDashboard } from "../../lib/tenants-api";
import type { BusinessCategory, BusinessGoal, CustomerType, OrderVolume } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";

const categories: { value: BusinessCategory; label: string; icon: typeof Package }[] = [
  { value: "fmcg", label: "FMCG", icon: Package },
  { value: "electronics", label: "Electronics", icon: Boxes },
  { value: "pharma", label: "Pharma", icon: Pill },
  { value: "apparel", label: "Apparel", icon: Shirt },
  { value: "auto_parts", label: "Auto Parts", icon: Wrench },
  { value: "grocery", label: "Grocery", icon: Building2},
  { value: "hardware", label: "Hardware", icon: Warehouse },
  { value: "other", label: "Other", icon: Sparkles },
];

const customerTypes: { value: CustomerType; label: string }[] = [
  { value: "wholesale", label: "Wholesale / B2B" },
  { value: "retail", label: "Retail" },
  { value: "both", label: "Both" },
];

const orderVolumes: { value: OrderVolume; label: string }[] = [
  { value: "lt_100", label: "< 100" },
  { value: "100_500", label: "100–500" },
  { value: "500_2000", label: "500–2,000" },
  { value: "gt_2000", label: "2,000+" },
];

const goalOptions: { value: BusinessGoal; label: string; icon: typeof Boxes }[] = [
  { value: "inventory_tracking", label: "Inventory tracking", icon: Boxes },
  { value: "credit_payments", label: "Credit & payment collection", icon: CreditCard },
  { value: "multi_warehouse", label: "Multi-warehouse ops", icon: Warehouse },
  { value: "staff_management", label: "Staff & role management", icon: Users },
  { value: "ai_insights", label: "AI-assisted insights", icon: Sparkles },
  { value: "reporting", label: "Reports & analytics", icon: Building2 },
];

const MAX_GOALS = 3;

type Step = 1 | 2 | 3 | "generating" | "done";

export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<BusinessCategory | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType | null>(null);
  const [orderVolume, setOrderVolume] = useState<OrderVolume | null>(null);
  const [warehouseCount, setWarehouseCount] = useState("1");
  const [staffCount, setStaffCount] = useState("1");
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [painPoints, setPainPoints] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
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
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setStep(3);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-surface shadow-elevation-3">
        {step !== "generating" && step !== "done" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Skip for now"
            className="absolute right-4 top-4 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        )}

        <div className="p-6">
          {step === 1 && (
            <>
              <h2 className="text-lg font-bold text-text">Tell us about your business</h2>
              <p className="mt-1 text-sm text-text-muted">This helps us tailor UManager to how you work.</p>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-muted">Business category</p>
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((c) => (
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
                      <c.icon size={18} />
                      <span className="text-center text-[11px] font-medium leading-tight">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-muted">Who are your customers?</p>
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
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="mt-6 w-full" disabled={!canContinueStep1} onClick={() => setStep(2)}>
                Continue
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-bold text-text">Your operations</h2>
              <p className="mt-1 text-sm text-text-muted">Roughly how big is your operation today?</p>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-muted">Monthly order volume</p>
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
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <TextField
                  label="Warehouses"
                  type="number"
                  min={0}
                  value={warehouseCount}
                  onChange={(e) => setWarehouseCount(e.target.value)}
                />
                <TextField
                  label="Staff members"
                  type="number"
                  min={0}
                  value={staffCount}
                  onChange={(e) => setStaffCount(e.target.value)}
                />
              </div>

              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button className="flex-1" disabled={!canContinueStep2} onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-bold text-text">What matters most?</h2>
              <p className="mt-1 text-sm text-text-muted">Pick up to {MAX_GOALS} priorities.</p>

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
                      <span className="leading-tight">{g.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5">
                <label className="mb-1.5 block text-sm font-medium text-text-muted" htmlFor="painPoints">
                  Anything specific slowing you down? (optional)
                </label>
                <textarea
                  id="painPoints"
                  value={painPoints}
                  onChange={(e) => setPainPoints(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. Tracking expiry dates, chasing customer payments…"
                  className="w-full resize-none rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
                />
              </div>

              {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button className="flex-1" disabled={!canSubmit} onClick={handleSubmit}>
                  Finish setup
                </Button>
              </div>
            </>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center py-6 text-center">
              <Loader2 size={32} className="animate-spin text-primary" />
              <h2 className="mt-4 text-lg font-bold text-text">Setting things up</h2>
              <p className="mt-1 text-sm text-text-muted">
                Saving your business profile and personalizing your dashboard…
              </p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-container text-success">
                <Sparkles size={26} />
              </span>
              <h2 className="mt-4 text-lg font-bold text-text">You&apos;re all set</h2>
              <p className="mt-1 text-sm text-text-muted">Your dashboard is ready.</p>
              <Button className="mt-5 w-full" onClick={onClose}>
                Go to dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
