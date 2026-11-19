import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { IndianRupee, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { inputClass } from "../../components/page/kit";
import { getPricing, refreshExchangeRate, savePricing, type Pricing, type PricingView } from "../../lib/admin-api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";
import { adminDate, lastSeen } from "./admin-format";

/** Rupees with enough decimals for tiny per-unit prices. */
const rs = (n: number) => `₹${n < 1 ? n.toFixed(4) : n < 100 ? n.toFixed(2) : n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * The AI price list the cost report uses. Groq bills in dollars, so each price
 * shows its rupee value at today's live rate. New calls are priced with it;
 * calls already recorded keep the price they had.
 */
export function PricingCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-pricing"], queryFn: getPricing });
  const [draft, setDraft] = useState<Pricing | null>(null);

  useEffect(() => {
    if (query.data && !draft) setDraft(query.data.pricing);
  }, [query.data, draft]);

  const applied = (view: PricingView) => {
    setDraft(view.pricing);
    queryClient.setQueryData(["admin-pricing"], view);
    void queryClient.invalidateQueries({ queryKey: ["admin-costs"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-ai-budgets"] });
  };

  const save = useMutation({
    mutationFn: () => savePricing(draft!),
    onSuccess: (view) => {
      applied(view);
      showSuccess(t("admin.pricing.saved"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const refresh = useMutation({
    mutationFn: refreshExchangeRate,
    onSuccess: (view) => {
      applied(view);
      showSuccess(view.fx ? `Dollar rate: ₹${view.fx.rate}` : "Couldn't reach the rate sources; keeping the last rate");
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const view = query.data;
  if (!draft || !view) return null;
  const fx = view.fx;
  // Rupee previews use the rate the prices will actually be saved with.
  const rate = draft.usdToInrAuto && fx ? fx.rate : draft.usdToInr;
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const field = (label: string, value: number, onChange: (n: number) => void, suffix?: string, inrHint?: string) => (
    <label className="block text-xs font-medium text-text-muted">
      {label}
      <div className="mt-1 flex items-center gap-1.5">
        <input type="number" inputMode="decimal" min={0} step="any" value={value} onChange={(e) => onChange(num(e.target.value))} className={`${inputClass} h-10 tabular-nums`} />
        {suffix ? <span className="shrink-0 text-xs text-text-muted">{suffix}</span> : null}
      </div>
      {inrHint ? <span className="mt-1 block tabular-nums text-text">{inrHint}</span> : null}
    </label>
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <IndianRupee size={18} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
        <div>
          <h3 className="text-base font-bold text-text">{t("admin.pricing.title")}</h3>
          <p className="text-sm text-text-muted">
            Groq bills in US dollars; each price below also shows what it costs in rupees at the dollar rate in use. Groq list prices checked on {adminDate(view.groqPricesChecked)} from{" "}
            <a href={view.sources.groq} target="_blank" rel="noreferrer" className="font-semibold text-primary underline-offset-2 hover:underline">
              console.groq.com/docs/models
            </a>
            .
          </p>
        </div>
      </div>

      {/* Dollar rate */}
      <div className="mt-4 rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">Dollar rate in use: ₹{rate} per $1</p>
            <p className="text-xs text-text-muted">
              {fx
                ? `Live rate ₹${fx.rate} · ${fx.source} · rate of ${adminDate(fx.asOf)} · fetched ${lastSeen(fx.fetchedAt)}`
                : "Live rate not fetched yet"}
            </p>
          </div>
          <Button variant="secondary" isLoading={refresh.isPending} onClick={() => refresh.mutate()}>
            <RefreshCw size={15} className="text-icon" aria-hidden="true" />
            Refresh rate
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Dollar rate">
          {([
            [true, "Live rate (updates twice a day)"],
            [false, "Fixed rate I type"],
          ] as const).map(([auto, label]) => (
            <button
              key={String(auto)}
              type="button"
              role="radio"
              aria-checked={draft.usdToInrAuto === auto}
              onClick={() => setDraft({ ...draft, usdToInrAuto: auto, ...(auto || !fx ? {} : { usdToInr: fx.rate }) })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                draft.usdToInrAuto === auto ? "border-primary bg-primary-container text-primary" : "border-border text-text-muted hover:border-primary/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!draft.usdToInrAuto ? (
          <div className="mt-3 max-w-xs">{field(t("admin.pricing.usdToInr"), draft.usdToInr, (n) => setDraft({ ...draft, usdToInr: n }), "₹ / $")}</div>
        ) : null}
      </div>

      {Object.entries(draft.tokens).map(([model, p]) => (
        <div key={model} className="mt-4">
          <p className="text-sm font-semibold text-text">
            {model} <span className="text-xs font-normal text-text-muted">{t("admin.pricing.perMillion")}</span>
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-3">
            {field(t("admin.pricing.input"), p.input, (n) => setDraft({ ...draft, tokens: { ...draft.tokens, [model]: { ...p, input: n } } }), "$", `= ${rs(p.input * rate)} / 1M`)}
            {field(t("admin.pricing.cached"), p.cachedInput, (n) => setDraft({ ...draft, tokens: { ...draft.tokens, [model]: { ...p, cachedInput: n } } }), "$", `= ${rs(p.cachedInput * rate)} / 1M`)}
            {field(t("admin.pricing.output"), p.output, (n) => setDraft({ ...draft, tokens: { ...draft.tokens, [model]: { ...p, output: n } } }), "$", `= ${rs(p.output * rate)} / 1M`)}
          </div>
        </div>
      ))}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {Object.entries(draft.whisperPerHourUsd).map(([model, perHour]) =>
          field(
            `${model} (${t("admin.pricing.perHour")})`,
            perHour,
            (n) => setDraft({ ...draft, whisperPerHourUsd: { ...draft.whisperPerHourUsd, [model]: n } }),
            "$",
            `= ${rs(perHour * rate)} / hour · ${rs((perHour * rate) / 60)} / min`
          )
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field(t("admin.pricing.sarvam"), draft.sarvamPerMinuteInr, (n) => setDraft({ ...draft, sarvamPerMinuteInr: n }), "₹ / min")}
        {Object.entries(draft.sarvamTtsPer1kInr ?? {}).map(([model, r]) =>
          field(`Sarvam voice ${model}`, r, (n) => setDraft({ ...draft, sarvamTtsPer1kInr: { ...draft.sarvamTtsPer1kInr, [model]: n } }), "₹ / 1K chars")
        )}
        {field(t("admin.pricing.whisperMin"), draft.whisperMinSeconds, (n) => setDraft({ ...draft, whisperMinSeconds: n }), "s")}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button isLoading={save.isPending} onClick={() => save.mutate()}>
          {t("admin.pricing.save")}
        </Button>
        <Button variant="secondary" onClick={() => setDraft(view.defaults)}>
          {t("admin.pricing.defaults")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-text-muted">{t("admin.pricing.note")}</p>
    </section>
  );
}
