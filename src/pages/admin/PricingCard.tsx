import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { IndianRupee } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { inputClass } from "../../components/page/kit";
import { getPricing, savePricing, type Pricing } from "../../lib/admin-api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

/**
 * The AI price list the cost report uses (Groq / Sarvam list prices). New
 * calls are priced with it; calls already recorded keep the price they had.
 */
export function PricingCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-pricing"], queryFn: getPricing });
  const [draft, setDraft] = useState<Pricing | null>(null);

  useEffect(() => {
    if (query.data && !draft) setDraft(query.data.pricing);
  }, [query.data, draft]);

  const save = useMutation({
    mutationFn: () => savePricing(draft!),
    onSuccess: (r) => {
      setDraft(r.pricing);
      queryClient.setQueryData(["admin-pricing"], { pricing: r.pricing, defaults: query.data?.defaults ?? r.pricing });
      void queryClient.invalidateQueries({ queryKey: ["admin-costs"] });
      showSuccess(t("admin.pricing.saved"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  if (!draft) return null;
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const field = (label: string, value: number, onChange: (n: number) => void, suffix?: string) => (
    <label className="block text-xs font-medium text-text-muted">
      {label}
      <div className="mt-1 flex items-center gap-1.5">
        <input type="number" inputMode="decimal" min={0} step="any" value={value} onChange={(e) => onChange(num(e.target.value))} className={`${inputClass} h-10 tabular-nums`} />
        {suffix ? <span className="shrink-0 text-xs text-text-muted">{suffix}</span> : null}
      </div>
    </label>
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <IndianRupee size={18} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
        <div>
          <h3 className="text-base font-bold text-text">{t("admin.pricing.title")}</h3>
          <p className="text-sm text-text-muted">{t("admin.pricing.body")}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field(t("admin.pricing.usdToInr"), draft.usdToInr, (n) => setDraft({ ...draft, usdToInr: n }), "₹ / $")}
        {field(t("admin.pricing.sarvam"), draft.sarvamPerMinuteInr, (n) => setDraft({ ...draft, sarvamPerMinuteInr: n }), "₹ / min")}
        {field(t("admin.pricing.whisperMin"), draft.whisperMinSeconds, (n) => setDraft({ ...draft, whisperMinSeconds: n }), "s")}
      </div>

      {Object.entries(draft.tokens).map(([model, p]) => (
        <div key={model} className="mt-4">
          <p className="text-sm font-semibold text-text">
            {model} <span className="text-xs font-normal text-text-muted">{t("admin.pricing.perMillion")}</span>
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-3">
            {field(t("admin.pricing.input"), p.input, (n) => setDraft({ ...draft, tokens: { ...draft.tokens, [model]: { ...p, input: n } } }), "$")}
            {field(t("admin.pricing.cached"), p.cachedInput, (n) => setDraft({ ...draft, tokens: { ...draft.tokens, [model]: { ...p, cachedInput: n } } }), "$")}
            {field(t("admin.pricing.output"), p.output, (n) => setDraft({ ...draft, tokens: { ...draft.tokens, [model]: { ...p, output: n } } }), "$")}
          </div>
        </div>
      ))}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {Object.entries(draft.whisperPerHourUsd).map(([model, perHour]) =>
          field(`${model} (${t("admin.pricing.perHour")})`, perHour, (n) => setDraft({ ...draft, whisperPerHourUsd: { ...draft.whisperPerHourUsd, [model]: n } }), "$")
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {Object.entries(draft.sarvamTtsPer1kInr ?? {}).map(([model, rate]) =>
          field(`Sarvam voice ${model}`, rate, (n) => setDraft({ ...draft, sarvamTtsPer1kInr: { ...draft.sarvamTtsPer1kInr, [model]: n } }), "₹ / 1K chars")
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button isLoading={save.isPending} onClick={() => save.mutate()}>
          {t("admin.pricing.save")}
        </Button>
        {query.data ? (
          <Button variant="secondary" onClick={() => setDraft(query.data!.defaults)}>
            {t("admin.pricing.defaults")}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-text-muted">{t("admin.pricing.note")}</p>
    </section>
  );
}
