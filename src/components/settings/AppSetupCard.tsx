import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";
import { OnboardingModal } from "../onboarding/OnboardingModal";
import { updateAppSetup } from "../../lib/tenants-api";
import { useAppSetup } from "../../lib/use-app-setup";
import { useAuthStore } from "../../lib/auth-store";
import type { AppFeatures } from "../../lib/auth-api";
import { errorMessage } from "../../lib/api-errors";
import { showError } from "../../lib/toast";
import { ProBadge } from "../ui/ProBadge";
import { usePlan } from "../../lib/use-plan";

// Parts of the app that need the Pro plan to actually work.
const PRO_KEYS: (keyof AppFeatures)[] = ["batch", "serial", "variants"];

const FEATURE_KEYS: (keyof AppFeatures)[] = [
  "counterSale",
  "cashbook",
  "orders",
  "purchases",
  "creditLimits",
  "warehouses",
  "staff",
  "rawMaterials",
  "batch",
  "serial",
  "variants",
];

/** The setup this business runs on: which parts of the app show, default bill type, and redoing setup. */
export function AppSetupCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { features, defaultBillType, template } = useAppSetup();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === "OWNER" || role === "MANAGER" || role === "SUPER_ADMIN";
  const [wizardOpen, setWizardOpen] = useState(false);
  const { isPro } = usePlan();

  const mutation = useMutation({
    mutationFn: updateAppSetup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: (err) => showError(errorMessage(err, t)),
  });

  return (
    <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-text">{t("appSetup.title")}</h3>
          <p className="mt-0.5 text-sm text-text-muted">
            {template && template !== "custom"
              ? t("appSetup.current", { setup: t(`setupTemplates.${template}.name`, { defaultValue: template }) })
              : t("appSetup.noneYet")}
          </p>
        </div>
        {canEdit ? (
          <Button variant="secondary" onClick={() => setWizardOpen(true)}>
            <RefreshCw size={15} aria-hidden="true" /> {t("appSetup.redo")}
          </Button>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-semibold text-text">{t("appSetup.billType")}</p>
        <SegmentedControl
          className="mt-2 w-full sm:w-auto"
          segments={[
            { key: "record", label: t("sale.simpleBill") },
            { key: "gst", label: t("sales.newSaleModal.gstBill") },
          ]}
          active={defaultBillType}
          onChange={(key) => canEdit && mutation.mutate({ defaultBillType: key as "gst" | "record" })}
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-text">{t("appSetup.featuresTitle")}</p>
        <p className="text-xs text-text-muted">{t("appSetup.featuresHint")}</p>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {FEATURE_KEYS.map((key) => (
            <li key={key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-text">
                  {t(`appSetup.feature.${key}.title`)}
                  {!isPro && PRO_KEYS.includes(key) ? <ProBadge /> : null}
                </p>
                <p className="text-xs text-text-muted">{t(`appSetup.feature.${key}.body`)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={features[key]}
                aria-label={t(`appSetup.feature.${key}.title`)}
                disabled={!canEdit || mutation.isPending}
                // cashbook is sent too, so older setups (where it followed counter sale) keep what they see now.
                onClick={() => mutation.mutate({ features: { cashbook: features.cashbook, [key]: !features[key] } })}
                className={clsx(
                  "relative h-7 w-12 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60",
                  features[key] ? "bg-primary" : "bg-surface-container-high"
                )}
              >
                <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", features[key] ? "left-6" : "left-1")} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <OnboardingModal open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
