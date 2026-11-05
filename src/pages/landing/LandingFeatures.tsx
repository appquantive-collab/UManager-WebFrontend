import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Boxes,
  Mic,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
  Warehouse,
} from "lucide-react";

const features = [
  { key: "inventory", icon: Boxes },
  { key: "salesPurchases", icon: ShoppingCart },
  { key: "customersSuppliers", icon: Users },
  { key: "aiAssistant", icon: Sparkles },
  { key: "voiceOcr", icon: Mic },
  { key: "multiWarehouse", icon: Warehouse },
  { key: "reports", icon: BarChart3 },
  { key: "tenantAudit", icon: ShieldCheck },
] as const;

export function LandingFeatures() {
  const { t } = useTranslation();

  return (
    <section id="features" className="mx-auto max-w-290 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">{t("landing.features.eyebrow")}</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          {t("landing.features.heading")}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          {t("landing.features.description")}
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.key}
            className="rounded-3xl border border-border bg-surface p-6 shadow-elevation-1 transition-all hover:-translate-y-1 hover:shadow-elevation-2"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-container text-primary">
              <feature.icon size={20} strokeWidth={1.9} />
            </span>
            <h3 className="mt-4 text-[15px] font-semibold text-text">{t(`landing.features.items.${feature.key}.title`)}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{t(`landing.features.items.${feature.key}.description`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
