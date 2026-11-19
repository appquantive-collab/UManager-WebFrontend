import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, FileText, Loader2, Pencil, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InvoiceDetailModal } from "../orders/InvoiceDetailModal";
import { OrderDetailModal } from "../orders/OrderDetailModal";
import { PurchaseDetailModal } from "../purchases/PurchaseDetailModal";
import { PartyPortfolioModal } from "../customers/PartyPortfolioModal";
import { AddCustomerModal, type EditableCustomer } from "../customers/AddCustomerModal";
import { getInvoice, type Invoice } from "../../lib/invoices-api";
import { getPurchase, type Purchase } from "../../lib/purchases-api";
import { getOrder, type Order } from "../../lib/orders-api";
import { getCustomerPortfolio } from "../../lib/customers-api";
import clsx from "clsx";
import { ApiError } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { showError } from "../../lib/toast";
import { confirmStep, dismissStep, type AiChatMessage, type StepLine, type StepType, type WorkflowStep } from "../../lib/ai-chat-api";

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
  const money = (v: unknown) => formatCurrency(Number(v ?? 0));
  // "naya naam Ravi Kumar, mobile 98…, bikri rate ₹35": only what changes.
  const changes = (payload: Record<string, unknown>) => {
    const parts: string[] = [];
    const add = (key: string, label: string, isMoney = false) => {
      const v = payload[key];
      if (v !== undefined && v !== null && v !== "") parts.push(`${label} ${isMoney ? money(v) : String(v)}`);
    };
    add("newName", t("ai.workflow.fields.newName"));
    add("phone", t("ai.workflow.fields.mobile"));
    add("address", t("ai.workflow.fields.address"));
    add("gstin", "GSTIN");
    add("department", t("ai.workflow.fields.department"));
    add("salePrice", t("ai.workflow.fields.salePrice"), true);
    add("purchasePrice", t("ai.workflow.fields.cost"), true);
    add("unit", t("ai.workflow.fields.unit"));
    add("reorderLevel", t("ai.workflow.fields.reorderLevel"));
    add("monthlySalary", t("ai.workflow.fields.salary"), true);
    add("dailyWage", t("ai.workflow.fields.dailyWage"), true);
    if (payload.role) parts.push(t(`team.role.${String(payload.role)}`));
    return parts.length ? `: ${parts.join(", ")}` : "";
  };
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
      case "create_staff":
        return t("ai.workflow.title.create_staff", { name: p.name, department: p.department ? ` · ${p.department}` : "" });
      case "receive_payment":
        return t("ai.workflow.title.receive_payment", { party: p.customerName, amount: money(step.payload.amount), bill: p.billNumber ? ` (${p.billNumber})` : "" });
      case "pay_supplier":
        return t("ai.workflow.title.pay_supplier", { party: p.supplierName, amount: money(step.payload.amount) });
      case "add_expense":
        return t("ai.workflow.title.add_expense", {
          amount: money(step.payload.amount),
          category: t(`expenses.category.${p.category ?? "other"}`),
          note: p.note ? ` · ${p.note}` : "",
        });
      case "edit_bill":
        return t("ai.workflow.title.edit_bill", { bill: p.billNumber, items: items(step.payload.items) });
      case "cancel_bill":
        return t("ai.workflow.title.cancel_bill", { bill: p.billNumber, reason: p.reason ? ` · ${p.reason}` : "" });
      case "bill_order":
        return t("ai.workflow.title.bill_order", { party: p.customerName });
      case "update_customer":
      case "update_supplier":
      case "update_product":
      case "update_staff":
        return t(`ai.workflow.title.${step.type}`, { name: p.name, changes: changes(step.payload) });
      case "adjust_stock": {
        const qty = Math.abs(Number(step.payload.quantity ?? 0));
        const out = p.reason === "damage" || p.direction === "out" || (p.direction === undefined && Number(step.payload.quantity) < 0);
        return t("ai.workflow.title.adjust_stock", { name: p.productName, change: `${out ? "−" : "+"}${qty}` });
      }
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
  if (step.type === "receive_payment" || step.type === "pay_supplier") {
    const customer = step.type === "receive_payment";
    return (
      <div className="grid grid-cols-2 gap-2">
        {text(customer ? "customerName" : "supplierName", customer ? t("ai.workflow.fields.customer") : t("ai.workflow.fields.supplier"))}
        {text("amount", t("ai.workflow.fields.amount"), { inputMode: "decimal" })}
        <label className="col-span-2 block min-w-0 text-xs font-medium text-text-muted sm:col-span-1">
          {t("ai.workflow.fields.method")}
          <select value={String(draft.paymentMethod ?? "cash")} onChange={(e) => set("paymentMethod", e.target.value)} className={clsx(inputClass, "mt-1")}>
            {(["cash", "upi", "bank_transfer", "cheque"] as const).map((m) => (
              <option key={m} value={m}>
                {t(`ai.workflow.method.${m}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }
  if (step.type === "add_expense") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {text("amount", t("ai.workflow.fields.amount"), { inputMode: "decimal" })}
        <label className="block min-w-0 text-xs font-medium text-text-muted">
          {t("ai.workflow.fields.category")}
          <select value={String(draft.category ?? "other")} onChange={(e) => set("category", e.target.value)} className={clsx(inputClass, "mt-1")}>
            {["rent", "salary", "electricity", "transport", "tea_food", "repairs", "phone_internet", "packing", "shop_supplies", "bank_charges", "other"].map((c) => (
              <option key={c} value={c}>
                {t(`expenses.category.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2">{text("note", t("ai.workflow.fields.note"))}</div>
      </div>
    );
  }
  if (step.type === "cancel_bill") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {text("billNumber", t("ai.workflow.fields.billNumber"))}
        {text("reason", t("ai.workflow.fields.reason"))}
      </div>
    );
  }
  if (step.type === "bill_order") {
    return <div className="grid grid-cols-1 gap-2">{text("customerName", t("ai.workflow.fields.customer"))}</div>;
  }
  if (step.type === "update_customer" || step.type === "update_supplier") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {text("name", t("ai.workflow.fields.name"))}
        {text("newName", t("ai.workflow.fields.newName"))}
        {text("phone", t("ai.workflow.fields.phone"), { inputMode: "tel" })}
        {step.type === "update_customer" ? text("address", t("ai.workflow.fields.address")) : text("gstin", "GSTIN")}
      </div>
    );
  }
  if (step.type === "update_product") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {text("name", t("ai.workflow.fields.item"))}
        {text("newName", t("ai.workflow.fields.newName"))}
        {text("salePrice", t("ai.workflow.fields.salePrice"), { inputMode: "decimal" })}
        {text("purchasePrice", t("ai.workflow.fields.cost"), { inputMode: "decimal" })}
      </div>
    );
  }
  if (step.type === "update_staff") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {text("name", t("ai.workflow.fields.name"))}
        {text("newName", t("ai.workflow.fields.newName"))}
        {text("phone", t("ai.workflow.fields.phone"), { inputMode: "tel" })}
        {text("department", t("ai.workflow.fields.department"))}
      </div>
    );
  }
  if (step.type === "adjust_stock") {
    const qty = Math.abs(Number(draft.quantity ?? 0)) || "";
    const out = draft.reason === "damage" || draft.direction === "out" || (draft.direction === undefined && Number(draft.quantity) < 0);
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">{text("productName", t("ai.workflow.fields.item"))}</div>
        <label className="block min-w-0 text-xs font-medium text-text-muted">
          {t("ai.workflow.fields.qty")}
          <input
            value={qty}
            onChange={(e) => set("quantity", e.target.value === "" ? undefined : Math.abs(Number(e.target.value)))}
            inputMode="decimal"
            className={clsx(inputClass, "mt-1 tabular-nums")}
          />
        </label>
        <label className="block min-w-0 text-xs font-medium text-text-muted">
          {t("ai.workflow.fields.direction")}
          <select
            value={out ? "out" : "in"}
            onChange={(e) => setDraft({ ...draft, direction: e.target.value, ...(e.target.value === "in" && draft.reason === "damage" ? { reason: "adjustment" } : {}) })}
            className={clsx(inputClass, "mt-1")}
          >
            <option value="out">{t("ai.workflow.stockOut")}</option>
            <option value="in">{t("ai.workflow.stockIn")}</option>
          </select>
        </label>
      </div>
    );
  }
  if (step.type === "create_staff") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {text("name", t("ai.workflow.fields.name"))}
        {text("phone", t("ai.workflow.fields.phone"), { inputMode: "tel", placeholder: "98230 45812" })}
        {text("department", t("ai.workflow.fields.department"), { placeholder: t("ai.workflow.fields.departmentHint") })}
        <label className="block min-w-0 text-xs font-medium text-text-muted">
          {t("ai.workflow.fields.role")}
          <select value={String(draft.role ?? "WAREHOUSE_STAFF")} onChange={(e) => set("role", e.target.value)} className={clsx(inputClass, "mt-1")}>
            {(["WAREHOUSE_STAFF", "SALESMAN", "MANAGER"] as const).map((r) => (
              <option key={r} value={r}>
                {t(`team.role.${r}`)}
              </option>
            ))}
          </select>
        </label>
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
  if (step.type === "record_purchase" || step.type === "create_bill" || step.type === "create_order" || step.type === "edit_bill") {
    const partyKey = step.type === "record_purchase" ? "supplierName" : step.type === "edit_bill" ? "billNumber" : "customerName";
    const lines = (draft.items as StepLine[] | undefined) ?? [];
    const setLine = (i: number, patch: Partial<StepLine>) => set("items", lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    const num = (v: string) => (v === "" ? undefined : Number(v));
    return (
      <div className="space-y-2">
        {text(partyKey, step.type === "record_purchase" ? t("ai.workflow.fields.supplier") : step.type === "edit_bill" ? t("ai.workflow.fields.billNumber") : t("ai.workflow.fields.customer"), {
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
    } else if (["purchasePrice", "salePrice", "paidAmount", "monthlySalary", "dailyWage", "amount", "quantity", "reorderLevel"].includes(key)) {
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
    for (const key of ["customers", "suppliers", "products", "purchases", "invoices", "stock-levels", "dashboard-summary", "orders", "staff", "departments", "expenses", "daybook"]) {
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

const BILL_STEPS = new Set<StepType>(["create_bill", "edit_bill", "cancel_bill", "bill_order"]);
const PURCHASE_STEPS = new Set<StepType>(["record_purchase", "pay_supplier"]);
const CUSTOMER_STEPS = new Set<StepType>(["create_customer", "update_customer", "receive_payment"]);
const PRODUCT_STEPS = new Set<StepType>(["create_product", "update_product", "adjust_stock"]);

const linkClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-text outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60";

/**
 * "Dekhein" / "Badlein" on every done step: bills, purchases, orders and
 * customers open right here in the chat (the bill view can also edit or cancel
 * it); items, staff, suppliers and expenses open their page in the app.
 */
function StepLinks({ step }: { step: WorkflowStep }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Invoice | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState<EditableCustomer | null>(null);
  const id = step.resultId;

  const open = useMutation({
    mutationFn: async (what: "view" | "edit") => {
      if (!id) return;
      if (BILL_STEPS.has(step.type)) setBill(await getInvoice(id));
      else if (PURCHASE_STEPS.has(step.type)) setPurchase(await getPurchase(id));
      else if (step.type === "create_order") setOrder(await getOrder(id));
      else if (CUSTOMER_STEPS.has(step.type)) {
        if (what === "view") setCustomerId(id);
        else setEditCustomer((await getCustomerPortfolio(id)).customer as EditableCustomer);
      }
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : t("ai.workflow.openFailed")),
  });

  // Pages in the app (closes Munshi on phones, since it's a page of its own there).
  const page =
    PRODUCT_STEPS.has(step.type) && id
      ? `/app/inventory/${id}/edit`
      : (step.type === "create_staff" || step.type === "update_staff") && id
        ? `/app/staff/${id}/edit`
        : step.type === "mark_attendance"
          ? "/app/staff"
          : step.type === "create_supplier" || step.type === "update_supplier"
            ? "/app/suppliers"
            : step.type === "add_expense"
              ? "/app/cashbook"
              : null;

  const viewLabel = BILL_STEPS.has(step.type)
    ? t("ai.workflow.viewBill")
    : PURCHASE_STEPS.has(step.type)
      ? t("ai.workflow.viewPurchase")
      : step.type === "create_order"
        ? t("ai.workflow.viewOrder")
        : page && (PRODUCT_STEPS.has(step.type) || step.type === "create_staff" || step.type === "update_staff")
          ? t("ai.workflow.openEdit")
          : t("ai.workflow.view");

  const inChat = Boolean(id) && (BILL_STEPS.has(step.type) || PURCHASE_STEPS.has(step.type) || step.type === "create_order" || CUSTOMER_STEPS.has(step.type));
  if (!inChat && !page) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      <button type="button" onClick={() => (inChat ? open.mutate("view") : navigate(page!))} disabled={open.isPending} className={linkClass}>
        {open.isPending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} className="text-icon" aria-hidden="true" />}
        {viewLabel}
      </button>
      {CUSTOMER_STEPS.has(step.type) && id ? (
        <button type="button" onClick={() => open.mutate("edit")} disabled={open.isPending} className={linkClass}>
          <Pencil size={13} className="text-icon" aria-hidden="true" />
          {t("ai.workflow.edit")}
        </button>
      ) : null}
      <InvoiceDetailModal invoice={bill} onClose={() => setBill(null)} />
      <PurchaseDetailModal purchase={purchase} onClose={() => setPurchase(null)} />
      <OrderDetailModal order={order} onClose={() => setOrder(null)} />
      <PartyPortfolioModal customerId={customerId} onClose={() => setCustomerId(null)} />
      {editCustomer ? <AddCustomerModal open onClose={() => setEditCustomer(null)} customer={editCustomer} /> : null}
    </div>
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
                    {step.resultSummary ? ` · ${step.resultSummary}` : ""}
                  </p>
                ) : null}
                {step.status === "confirmed" ? <StepLinks step={step} /> : null}
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
