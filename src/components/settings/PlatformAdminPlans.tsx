import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Gift } from "lucide-react";
import { Button } from "../ui/Button";
import { SearchInput } from "../ui/SearchInput";
import { SegmentedControl } from "../ui/SegmentedControl";
import { EmptyHelp, Field, LoadingRows, ModalShell, StatusPill, inputClass } from "../page/kit";
import { grantPlan, listAllBusinesses, type AdminTenantRow } from "../../lib/billing-api";
import type { BillingPeriod, PlanKey } from "../../lib/auth-api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

/**
 * SethSathi team only (PLATFORM_ADMIN_EMAILS): every business with its plan,
 * and giving or extending a plan by hand — offline UPI/bank payments, free
 * months, support cases.
 */
export function PlatformAdminPlans() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [granting, setGranting] = useState<AdminTenantRow | null>(null);
  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const list = useQuery({ queryKey: ["admin-businesses", debounced], queryFn: () => listAllBusinesses(debounced) });

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h3 className="text-base font-bold text-text">{t("planAdmin.title")}</h3>
        <p className="text-sm text-text-muted">{t("planAdmin.body")}</p>
      </div>
      <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("planAdmin.search")} aria-label={t("planAdmin.search")} />
      {list.isLoading ? (
        <LoadingRows rows={4} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyHelp icon={Gift} title={t("planAdmin.emptyTitle")} body={t("planAdmin.emptyBody")} />
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {(list.data ?? []).map((row) => (
            <li key={row.tenantId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{row.businessName}</p>
                <p className="truncate text-xs text-text-muted">
                  {row.ownerEmail}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <StatusPill tone={row.state.status === "expired" ? "danger" : row.state.status === "active" ? "success" : "neutral"}>
                    {row.state.status === "trial" ? t("plan.trialName") : `${t(`plan.name.${row.state.plan ?? "basic"}`)} · ${t(`plan.status.${row.state.status}`)}`}
                  </StatusPill>
                  {row.state.endsAt ? <span>{t("plan.until", { date: new Date(row.state.endsAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })}</span> : null}
                  <span>{t("planAdmin.aiUsed", { used: row.aiTokensUsed.toLocaleString("en-IN") })}</span>
                </div>
              </div>
              <Button variant="secondary" onClick={() => setGranting(row)}>
                <Gift size={15} aria-hidden="true" /> {t("planAdmin.give")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <GrantModal row={granting} onClose={() => setGranting(null)} />
    </div>
  );
}

function GrantModal({ row, onClose }: { row: AdminTenantRow | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState<PlanKey>("basic");
  const [length, setLength] = useState<BillingPeriod | "days">("monthly");
  const [days, setDays] = useState("30");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!row) return;
    setPlan(row.state.plan ?? "basic");
    setLength("monthly");
    setDays("30");
    setAmount("");
    setNote("");
  }, [row]);

  const mutation = useMutation({
    mutationFn: () =>
      grantPlan({
        tenantId: row!.tenantId,
        plan,
        ...(length === "days" ? { days: Math.max(1, Math.round(Number(days) || 0)) } : { period: length }),
        amount: Number(amount) || 0,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
      showSuccess(t("planAdmin.given", { business: row?.businessName ?? "" }));
      onClose();
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const daysValid = length !== "days" || (Number(days) >= 1 && Number(days) <= 730);

  return (
    <ModalShell open={Boolean(row)} onClose={onClose} title={t("planAdmin.giveTitle", { business: row?.businessName ?? "" })} subtitle={t("planAdmin.giveBody")} closeLabel={t("common.close")}>
      <div className="space-y-4">
        <Field label={t("planAdmin.plan")}>
          <SegmentedControl
            className="w-full"
            segments={[
              { key: "basic", label: t("plan.name.basic") },
              { key: "pro", label: t("plan.name.pro") },
            ]}
            active={plan}
            onChange={(k) => setPlan(k as PlanKey)}
          />
        </Field>
        <Field label={t("planAdmin.length")}>
          <SegmentedControl
            className="w-full"
            segments={[
              { key: "monthly", label: t("plan.period.monthly") },
              { key: "quarterly", label: t("plan.period.quarterly") },
              { key: "annual", label: t("plan.period.annual") },
              { key: "days", label: t("planAdmin.customDays") },
            ]}
            active={length}
            onChange={(k) => setLength(k as BillingPeriod | "days")}
          />
        </Field>
        {length === "days" ? (
          <Field label={t("planAdmin.days")} htmlFor="grant-days">
            <input id="grant-days" type="number" inputMode="numeric" min={1} max={730} className={inputClass} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        ) : null}
        <Field label={t("planAdmin.amount")} hint={t("planAdmin.amountHint")} htmlFor="grant-amount">
          <input id="grant-amount" type="number" inputMode="decimal" min={0} className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label={t("planAdmin.note")} htmlFor="grant-note">
          <input id="grant-note" className={inputClass} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("planAdmin.notePlaceholder")} />
        </Field>
        <p className="text-xs text-text-muted">{t("planAdmin.addsNote")}</p>
        <Button className="w-full" isLoading={mutation.isPending} disabled={!daysValid} onClick={() => mutation.mutate()}>
          {t("planAdmin.confirm")}
        </Button>
      </div>
    </ModalShell>
  );
}
