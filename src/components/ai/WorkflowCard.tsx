import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, FileText, Loader2, Plus, X } from "lucide-react";
import { InvoiceDetailModal } from "../orders/InvoiceDetailModal";
import { PurchaseDetailModal } from "../purchases/PurchaseDetailModal";
import { getInvoice, type Invoice } from "../../lib/invoices-api";
import { getPurchase, type Purchase } from "../../lib/purchases-api";
import clsx from "clsx";
import { ApiError } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { showError } from "../../lib/toast";
import { confirmStep, dismissStep, type AiChatMessage, type StepLine, type WorkflowStep } from "../../lib/ai-chat-api";

/**
 * A Munshi AI workflow inside a chat reply: the steps it made from the
 * message ("add supplier → record purchase → bill Ravi → bill Kishan"). Only
 * the first waiting step is open: its details can be corrected, then done or
 * skipped, and the next one opens. Nothing is saved until the user confirms.
 */

const FORCE_CODES = new Set(["INSUFFICIENT_STOCK", "CREDIT_LIMIT"]);

function useStepText() {
  const { t } = useTranslation();
  const items = (lines: StepLine[] | undefined) =>
    (lines ?? [])
      .map((l) => `${l.productName} ${l.quantity}${l.unit ? ` ${l.unit}` : ""}${l.price ? ` @ ${formatCurrency(l.price)}` : ""}`)
      .join(", ");
  return (step: WorkflowStep): string => {
    const p = step.payload as Record<string, string | undefined>;
    switch (step.type) {
      case "create_customer":
        return t("ai.workflow.title.create_customer", { name: p.name });
      case "create_supplier":
        return t("ai.workflow.title.create_supplier", { name: p.name });
      case "create_product":
        return t("ai.workflow.title.create_product", { name: p.name });
      case "record_purchase":
        return t("ai.workflow.title.record_purchase", { party: p.supplierName, items: items(step.payload.items) });
      case "create_bill":
        return t("ai.workflow.title.create_bill", { party: p.customerName || t("ai.workflow.counterSale"), items: items(step.payload.items) });
      case "create_order":
        return t("ai.workflow.title.create_order", { party: p.customerName, items: items(step.payload.items) });
      case "mark_attendance":
        return t("ai.workflow.title.mark_attendance", { name: p.staffName, status: String(p.status ?? "").replace("_", " "), date: p.date });
    }
  };
}

const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

/** Editable details of the open step. */
function StepEditor({ step, draft, setDraft }: { step: WorkflowStep; draft: Record<string, unknown>; setDraft: (next: Record<string, unknown>) => void }) {
  const { t } = useTranslation();
  const set = (key: string, value: unknown) => setDraft({ ...draft, [key]: value });
  const text = (key: string, label: string, opts: { inputMode?: "tel" | "decimal"; placeholder?: string } = {}) => (
    <label className="block min-w-0 text-xs font-medium text-text-muted">
      {label}
      <input
        value={draft[key] === undefined || draft[key] === null ? "" : String(draft[key])}
        onChange={(e) => set(key, opts.inputMode === "decimal" ? (e.target.value === "" ? undefined : e.target.value) : e.target.value)}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        className={clsx(inputClass, "mt-1")}
      />
    </label>
  );

  if (step.type === "create_customer" || step.type === "create_supplier") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {text("name", t("ai.workflow.fields.name"))}
        {text("phone", t("ai.workflow.fields.phone"), { inputMode: "tel", placeholder: "98230 45812" })}
      </div>
    );
  }
  if (step.type === "create_product") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {text("name", t("ai.workflow.fields.item"))}
        {text("unit", t("ai.workflow.fields.unit"), { placeholder: "kg / pcs" })}
        {text("purchasePrice", t("ai.workflow.fields.cost"), { inputMode: "decimal" })}
        {text("salePrice", t("ai.workflow.fields.salePrice"), { inputMode: "decimal" })}
      </div>
    );
  }
  if (step.type === "record_purchase" || step.type === "create_bill" || step.type === "create_order") {
    const partyKey = step.type === "record_purchase" ? "supplierName" : "customerName";
    const lines = (draft.items as StepLine[] | undefined) ?? [];
    const setLine = (i: number, patch: Partial<StepLine>) => set("items", lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    const num = (v: string) => (v === "" ? undefined : Number(v));
    return (
      <div className="space-y-2">
        {text(partyKey, step.type === "record_purchase" ? t("ai.workflow.fields.supplier") : t("ai.workflow.fields.customer"), {
          placeholder: step.type === "create_bill" ? t("ai.workflow.counterSale") : undefined,
        })}
        <div className="space-y-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4rem_5rem] gap-1.5 text-xs font-medium text-text-muted">
            <span>{t("ai.workflow.fields.item")}</span>
            <span>{t("ai.workflow.fields.qty")}</span>
            <span>{t("ai.workflow.fields.unit")}</span>
            <span>{step.type === "record_purchase" ? t("ai.workflow.fields.cost") : t("ai.workflow.fields.rate")}</span>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4rem_5rem] gap-1.5">
              <input value={line.productName} onChange={(e) => setLine(i, { productName: e.target.value })} aria-label={t("ai.workflow.fields.item")} className={inputClass} />
              <input value={line.quantity ?? ""} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} inputMode="decimal" aria-label={t("ai.workflow.fields.qty")} className={clsx(inputClass, "tabular-nums")} />
              <input value={line.unit ?? ""} onChange={(e) => setLine(i, { unit: e.target.value || undefined })} aria-label={t("ai.workflow.fields.unit")} className={inputClass} />
              <input
                value={line.price ?? ""}
                onChange={(e) => setLine(i, { price: num(e.target.value) })}
                inputMode="decimal"
                placeholder={t("ai.workflow.savedPrice")}
                aria-label={t("ai.workflow.fields.rate")}
                className={clsx(inputClass, "tabular-nums")}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

/** Clean up edits before sending: numbers as numbers, empty text dropped. */
function cleanPayload(draft: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value === "" || value === undefined || value === null) continue;
    if (key === "items" && Array.isArray(value)) {
      out.items = (value as StepLine[]).map((l) => ({
        productName: l.productName,
        quantity: Number(l.quantity),
        ...(l.unit ? { unit: l.unit } : {}),
        ...(l.price !== undefined && String(l.price) !== "" ? { price: Number(l.price) } : {}),
      }));
    } else if (["purchasePrice", "salePrice", "paidAmount"].includes(key)) {
      out[key] = Number(value);
    } else out[key] = value;
  }
  return out;
}

function ActiveStep({ message, step, index, total }: { message: AiChatMessage; step: WorkflowStep; index: number; total: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const stepText = useStepText();
  const [draft, setDraft] = useState<Record<string, unknown>>(() => structuredClone(step.payload));
  const [warning, setWarning] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["ai-chat-messages"] });
    // What a step changes shows up elsewhere in the app right away.
    for (const key of ["customers", "suppliers", "products", "purchases", "invoices", "stock-levels", "dashboard-summary", "orders"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const confirm = useMutation({
    mutationFn: (force: boolean) => confirmStep(message._id, step.id, { payload: cleanPayload(draft), force }),
    onSuccess: () => {
      setWarning(null);
      refresh();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code && FORCE_CODES.has(err.code)) {
        setWarning(t(`ai.workflow.warning.${err.code}`));
        return;
      }
      showError(err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotConfirmAction"));
    },
  });
  const skip = useMutation({
    mutationFn: () => dismissStep(message._id, step.id),
    onSuccess: refresh,
    onError: (err) => showError(err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotDismissAction")),
  });
  const busy = confirm.isPending || skip.isPending;
  const editable = step.type !== "mark_attendance";

  return (
    <li className="rounded-xl border border-primary/40 bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">{stepText({ ...step, payload: draft as WorkflowStep["payload"] })}</p>
          {step.auto ? <p className="mt-0.5 text-xs text-text-muted">{t("ai.workflow.autoAdded")}</p> : null}
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-text-muted">
          {index + 1}/{total}
        </span>
      </div>

      {editable ? (
        <div className="mt-3">
          <StepEditor step={step} draft={draft} setDraft={setDraft} />
        </div>
      ) : null}

      {warning ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{warning}</span>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => skip.mutate()}
          disabled={busy}
          className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text-muted outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
        >
          {skip.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} aria-hidden="true" />}
          {t("ai.workflow.skip")}
        </button>
        <button
          type="button"
          onClick={() => confirm.mutate(Boolean(warning))}
          disabled={busy}
          className={clsx(
            "flex min-h-10 flex-[1.4] items-center justify-center gap-1 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
            warning ? "bg-danger text-white hover:bg-danger/90" : "bg-primary text-on-primary hover:bg-primary-hover"
          )}
        >
          {confirm.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} aria-hidden="true" />}
          {warning ? t("ai.workflow.anyway") : t("ai.workflow.confirm")}
        </button>
      </div>
    </li>
  );
}

/** "Bill dekhein" / "Kharid dekhein" on a done step: opens it right here in the chat. */
function OpenResult({ step }: { step: WorkflowStep }) {
  const { t } = useTranslation();
  const [bill, setBill] = useState<Invoice | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const open = useMutation({
    mutationFn: async () => {
      if (step.type === "create_bill") setBill(await getInvoice(step.resultId!));
      else setPurchase(await getPurchase(step.resultId!));
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : t("ai.workflow.openFailed")),
  });
  if (!step.resultId || (step.type !== "create_bill" && step.type !== "record_purchase")) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => open.mutate()}
        disabled={open.isPending}
        className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-text outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
      >
        {open.isPending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} className="text-icon" aria-hidden="true" />}
        {step.type === "create_bill" ? t("ai.workflow.viewBill") : t("ai.workflow.viewPurchase")}
      </button>
      <InvoiceDetailModal invoice={bill} onClose={() => setBill(null)} />
      <PurchaseDetailModal purchase={purchase} onClose={() => setPurchase(null)} />
    </>
  );
}

export function WorkflowCard({ message }: { message: AiChatMessage }) {
  const { t } = useTranslation();
  const stepText = useStepText();
  const steps = message.steps ?? [];
  const activeIndex = steps.findIndex((s) => s.status === "pending");
  // Replaced steps aren't work done: they moved to a corrected list further down.
  const live = steps.filter((s) => !s.replaced);
  const done = live.filter((s) => s.status !== "pending").length;
  const confirmed = live.filter((s) => s.status === "confirmed").length;
  const replacedAll = steps.length > 0 && live.length === 0;

  return (
    <div className="mt-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("ai.workflow.heading")}</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-variant" aria-hidden="true">
          <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: `${(done / Math.max(1, live.length)) * 100}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums text-text-muted">{replacedAll ? t("ai.workflow.listReplaced") : t("ai.workflow.progress", { done, total: live.length })}</span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((step, i) =>
          i === activeIndex ? (
            <ActiveStep key={step.id} message={message} step={step} index={i} total={steps.length} />
          ) : (
            <li key={step.id} className="flex items-start gap-2.5 px-1 py-1">
              {step.status === "confirmed" ? (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </span>
              ) : step.status === "dismissed" ? (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-text-muted">
                  <X size={11} aria-hidden="true" />
                </span>
              ) : (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-text-muted">{i + 1}</span>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className={clsx(step.status === "dismissed" ? "text-text-muted line-through" : step.status === "pending" ? "text-text-muted" : "text-text")}>
                  {stepText(step)}
                </p>
                {step.status === "confirmed" ? (
                  <p className="text-xs text-success">
                    {t(`ai.workflow.done.${step.type}`)}
                    {step.resultSummary && (step.type === "create_bill" || step.type === "record_purchase") ? ` · ${step.resultSummary}` : ""}
                  </p>
                ) : null}
                {step.status === "confirmed" ? <OpenResult step={step} /> : null}
                {step.status === "dismissed" ? <p className="text-xs text-text-muted">{step.replaced ? t("ai.workflow.replaced") : t("ai.workflow.skipped")}</p> : null}
              </div>
              {step.status === "pending" && step.auto ? <Plus size={14} className="mt-1 shrink-0 text-icon" aria-label={t("ai.workflow.autoAdded")} /> : null}
            </li>
          )
        )}
      </ol>
      {activeIndex < 0 && confirmed > 0 ? <p className="mt-2 text-sm font-semibold text-success">{t("ai.workflow.allDone")}</p> : null}
    </div>
  );
}
