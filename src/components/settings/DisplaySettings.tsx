import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Glasses, IndianRupee, LayoutGrid, MonitorSmartphone, RotateCcw, Rows2, Rows4, Sparkles, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { matchingPreset, useDisplayStore, type Density, type DisplayPreset, type TextSize } from "../../lib/display-settings";

// Settings → Display: text size and layout density, with one-tap presets for
// a sleek modern look, the standard look, or easy reading. Changes apply live.

const presetIcons: Record<DisplayPreset, LucideIcon> = { modern: Sparkles, standard: LayoutGrid, easy: Glasses };
// Swatch sizes in px so each "Aa" shows its real size whatever the current setting.
const sampleSize: Record<TextSize, number> = { small: 14, medium: 16, large: 18, xlarge: 20 };

function OptionButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "relative rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
        selected ? "border-primary bg-primary-container text-on-primary-container" : "border-border bg-surface text-text hover:border-primary/40",
        className
      )}
    >
      {selected ? <Check size={16} className="absolute right-2.5 top-2.5 text-primary" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function DisplaySettings() {
  const { t } = useTranslation();
  const textSize = useDisplayStore((state) => state.textSize);
  const density = useDisplayStore((state) => state.density);
  const setTextSize = useDisplayStore((state) => state.setTextSize);
  const setDensity = useDisplayStore((state) => state.setDensity);
  const applyPreset = useDisplayStore((state) => state.applyPreset);
  const activePreset = matchingPreset({ textSize, density });

  return (
    <div className="max-w-3xl space-y-5">
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-elevation-1">
        <div>
          <h3 className="text-base font-bold text-text">{t("display.presetsTitle")}</h3>
          <p className="mt-0.5 text-sm text-text-muted">{t("display.presetsHint")}</p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(["modern", "standard", "easy"] as const).map((preset) => {
            const Icon = presetIcons[preset];
            return (
              <OptionButton key={preset} selected={activePreset === preset} onClick={() => applyPreset(preset)}>
                <Icon size={20} strokeWidth={1.75} className="text-icon" aria-hidden="true" />
                <span className="mt-2 block text-sm font-bold">{t(`display.preset.${preset}.title`)}</span>
                <span className="mt-0.5 block text-xs text-text-muted">{t(`display.preset.${preset}.body`)}</span>
              </OptionButton>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-elevation-1">
        <div>
          <h3 className="text-base font-bold text-text">{t("display.textSizeTitle")}</h3>
          <p className="mt-0.5 text-sm text-text-muted">{t("display.textSizeHint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(["small", "medium", "large", "xlarge"] as const).map((size) => (
            <OptionButton key={size} selected={textSize === size} onClick={() => setTextSize(size)} className="text-center">
              <span className="block font-bold leading-none" style={{ fontSize: `${sampleSize[size] * 1.5}px` }} aria-hidden="true">
                Aa
              </span>
              <span className="mt-2 block text-sm font-semibold">{t(`display.size.${size}`)}</span>
            </OptionButton>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-elevation-1">
        <div>
          <h3 className="text-base font-bold text-text">{t("display.layoutTitle")}</h3>
          <p className="mt-0.5 text-sm text-text-muted">{t("display.layoutHint")}</p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(["compact", "comfortable"] as Density[]).map((option) => {
            const Icon = option === "compact" ? Rows4 : Rows2;
            return (
              <OptionButton key={option} selected={density === option} onClick={() => setDensity(option)}>
                <Icon size={20} strokeWidth={1.75} className="text-icon" aria-hidden="true" />
                <span className="mt-2 block text-sm font-bold">{t(`display.density.${option}.title`)}</span>
                <span className="mt-0.5 block text-xs text-text-muted">{t(`display.density.${option}.body`)}</span>
              </OptionButton>
            );
          })}
        </div>
      </section>

      {/* Live preview built from the same styles as the app, so it shows exactly how screens will look. */}
      <section className="space-y-3 rounded-2xl border border-dashed border-primary/40 bg-background p-5" aria-label={t("display.previewTitle")}>
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{t("display.previewTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-text-muted">{t("dashboard.desk.todaysSales")}</span>
              <IndianRupee size={18} strokeWidth={1.75} className="text-icon" aria-hidden="true" />
            </div>
            <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-text">₹12,450</p>
            <p className="mt-0.5 text-sm text-text-muted">{t("dashboard.desk.bills", { count: 8 })}</p>
          </div>
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
            <p className="text-sm font-bold text-text">{t("display.previewList")}</p>
            {[
              { name: "Sharma Traders", amount: "₹4,200" },
              { name: "Gupta Kirana", amount: "₹1,850" },
            ].map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-2 border-t border-border pt-2 text-sm">
                <span className="font-semibold text-text">{row.name}</span>
                <span className="font-bold tabular-nums text-danger">{row.amount}</span>
              </div>
            ))}
            <span className="mt-1 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary" aria-hidden="true">
              {t("sales.salesPage.newSale")}
            </span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <MonitorSmartphone size={16} className="text-icon" aria-hidden="true" />
          {t("display.deviceNote")}
        </p>
        {activePreset !== "standard" ? (
          <button
            type="button"
            onClick={() => applyPreset("standard")}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary outline-none hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t("display.reset")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
