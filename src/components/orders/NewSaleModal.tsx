import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Check, FileText, Plus, Receipt, ReceiptText, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { listCustomers, createCustomer, type CustomerListItem } from "../../lib/customers-api";
import {
  getCustomerPendingItems,
  createBill,
  recordPayment,
  type BillType,
  type Invoice,
  type PaymentMethod,
} from "../../lib/invoices-api";
import { ApiError } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

interface DraftItem {
  key: string;
  orderId?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isNew: boolean;
}

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `bill-item-${keySeq}`;
}

function emptyItem(): DraftItem {
  return { key: nextKey(), productName: "", quantity: 1, unit: "pcs", unitPrice: 0, isNew: true };
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank" },
  { value: "cheque", label: "Cheque" },
  { value: "credit", label: "Credit" },
];

type Step = "customer" | "items" | "bill-type" | "payment" | "done";

export function NewSaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("customer");

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [items, setItems] = useState<DraftItem[]>([]);
  const [billType, setBillType] = useState<BillType>("record");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const allCustomersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => listCustomers(),
    enabled: open,
  });
  const selectedCustomer = allCustomersQuery.data?.find((c) => c._id === customerId) ?? null;
  const filteredCustomers = allCustomersQuery.data?.filter((c) =>
    c.name.toLowerCase().includes(customerQuery.trim().toLowerCase())
  );

  const pendingItemsQuery = useQuery({
    queryKey: ["invoices", "pending-items", customerId],
    queryFn: () => getCustomerPendingItems(customerId!),
    enabled: Boolean(customerId) && step === "items",
  });

  useEffect(() => {
    if (pendingItemsQuery.data) {
      setItems(
        pendingItemsQuery.data.items.map((i) => ({
          key: nextKey(),
          orderId: i.orderId,
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          isNew: false,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingItemsQuery.data]);

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(customer._id);
      setShowNewCustomerForm(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setStep("items");
    },
  });

  const createBillMutation = useMutation({
    mutationFn: createBill,
    onSuccess: (inv) => {
      setInvoice(inv);
      setAmount(String(inv.totalAmount));
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setStep("payment");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Couldn't generate the bill. Please try again.");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ invoiceId, amount, method }: { invoiceId: string; amount: number; method: PaymentMethod }) =>
      recordPayment(invoiceId, { amount, method }),
    onSuccess: (inv) => {
      setInvoice(inv);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setStep("done");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Couldn't record the payment. Please try again.");
    },
  });

  useEffect(() => {
    if (!open) {
      setStep("customer");
      setCustomerId(null);
      setCustomerQuery("");
      setShowNewCustomerForm(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setItems([]);
      setBillType("record");
      setInvoice(null);
      setMethod("cash");
      setAmount("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const removeItem = (key: string) => setItems((current) => current.filter((it) => it.key !== key));
  const addBlankItem = () => setItems((current) => [...current, emptyItem()]);

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const hasZeroPriceNewItem = items.some((i) => i.isNew && (!i.unitPrice || i.unitPrice <= 0));
  const canProceedFromItems =
    items.length > 0 && items.every((i) => i.productName.trim() && i.quantity > 0) && !hasZeroPriceNewItem;

  const orderIds = [...new Set(items.map((i) => i.orderId).filter((id): id is string => Boolean(id)))];

  const handleGenerateBill = () => {
    if (!customerId) return;
    setError(null);
    createBillMutation.mutate({
      customerId,
      orderIds,
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName.trim(),
        quantity: Number(i.quantity),
        unit: i.unit || "pcs",
        unitPrice: Number(i.unitPrice) || 0,
      })),
      billType,
    });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-surface shadow-elevation-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto p-6">
          {step === "customer" && (
            <>
              <h2 className="text-lg font-bold text-text">New sale</h2>
              <p className="mt-1 text-sm text-text-muted">Pick the party you're billing.</p>

              <div className="mt-4">
                <TextField
                  label="Search customers"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Type a name…"
                  autoFocus
                />
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {filteredCustomers?.map((c: CustomerListItem) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c._id);
                        setStep("items");
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-border px-3.5 py-2.5 text-left outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <span className="font-medium text-text">{c.name}</span>
                      {c.phone ? <span className="text-xs text-text-muted">{c.phone}</span> : null}
                    </button>
                  ))}
                  {filteredCustomers?.length === 0 && (
                    <p className="px-1 py-2 text-sm text-text-muted">No matches.</p>
                  )}
                </div>

                {!showNewCustomerForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCustomerForm(true);
                      setNewCustomerName(customerQuery);
                    }}
                    className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Plus size={14} /> Add new customer
                  </button>
                ) : (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <TextField label="Name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                    <TextField
                      label="Phone (optional)"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                    />
                    <Button
                      className="w-full"
                      disabled={!newCustomerName.trim()}
                      isLoading={createCustomerMutation.isPending}
                      onClick={() =>
                        createCustomerMutation.mutate({
                          name: newCustomerName.trim(),
                          phone: newCustomerPhone.trim() || undefined,
                        })
                      }
                    >
                      Save &amp; continue
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {step === "items" && selectedCustomer && (
            <>
              <h2 className="text-lg font-bold text-text">{selectedCustomer.name}</h2>
              <p className="mt-1 text-sm text-text-muted">
                {pendingItemsQuery.isLoading
                  ? "Loading their pending orders…"
                  : items.some((i) => i.orderId)
                    ? "Everything they've ordered — edit, remove, or add items."
                    : "No pending orders for this party — add items to bill."}
              </p>

              <div className="mt-4 space-y-2.5">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className={clsx(
                      "rounded-xl border p-3",
                      item.isNew ? "border-warning/50 bg-warning-container/20" : "border-border bg-surface"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {item.isNew ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-warning">
                          <AlertTriangle size={12} /> New item
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-success">
                          <Check size={12} /> From order
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label="Remove item"
                        className="rounded-full p-1 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <input
                      value={item.productName}
                      onChange={(e) => updateItem(item.key, { productName: e.target.value })}
                      placeholder="Product name"
                      className="mt-2 w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
                    />

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-text-muted">Qty</label>
                        <input
                          type="number"
                          min={0.001}
                          step="any"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) })}
                          className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-muted">Unit</label>
                        <input
                          value={item.unit}
                          onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                          className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label
                          className={clsx(
                            "text-xs",
                            item.isNew && (!item.unitPrice || item.unitPrice <= 0) ? "font-semibold text-danger" : "text-text-muted"
                          )}
                        >
                          Price {item.isNew ? "*" : ""}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.key, { unitPrice: Number(e.target.value) })}
                          className={clsx(
                            "mt-0.5 w-full rounded-lg border bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary",
                            item.isNew && (!item.unitPrice || item.unitPrice <= 0) ? "border-danger" : "border-transparent"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addBlankItem}
                className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Plus size={14} /> Add item
              </button>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-surface-variant px-3.5 py-2.5">
                <span className="text-sm font-medium text-text-muted">Total</span>
                <span className="text-base font-bold text-text">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep("customer")}>
                  Back
                </Button>
                <Button className="flex-1" disabled={!canProceedFromItems} onClick={() => setStep("bill-type")}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === "bill-type" && (
            <>
              <h2 className="text-lg font-bold text-text">Choose bill type</h2>
              <p className="mt-1 text-sm text-text-muted">{formatCurrency(totalAmount)} total</p>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setBillType("gst")}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                    billType === "gst" ? "border-primary bg-primary-container/40" : "border-border hover:border-primary/30"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                    <ReceiptText size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-text">GST Bill</span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      Formal tax invoice with GST added per item, using each product's tax rate.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBillType("record")}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                    billType === "record" ? "border-primary bg-primary-container/40" : "border-border hover:border-primary/30"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-variant text-text">
                    <FileText size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-text">Record Bill</span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      Simple receipt, no tax added — for cash/retail sales that don't need a tax invoice.
                    </span>
                  </span>
                </button>
              </div>

              {error ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-danger">
                  <AlertTriangle size={14} /> {error}
                </p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep("items")}>
                  Back
                </Button>
                <Button className="flex-1" isLoading={createBillMutation.isPending} onClick={handleGenerateBill}>
                  Generate bill
                </Button>
              </div>
            </>
          )}

          {step === "payment" && invoice && (
            <>
              <h2 className="text-lg font-bold text-text">{invoice.invoiceNumber}</h2>
              <p className="mt-1 text-sm text-text-muted">Record the payment received.</p>

              <div className="mt-4 space-y-1.5 rounded-lg bg-surface-variant px-3.5 py-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Subtotal</span>
                  <span className="text-text">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">GST</span>
                    <span className="text-text">{formatCurrency(invoice.taxTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold">
                  <span className="text-text">Total</span>
                  <span className="text-text">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-1.5 text-sm font-medium text-text-muted">Payment method</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={clsx(
                        "rounded-lg border px-2 py-2 text-xs font-semibold outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-primary/40",
                        method === m.value
                          ? "border-primary bg-primary-container text-primary"
                          : "border-border text-text-muted hover:border-primary/30"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-text-muted" htmlFor="paymentAmount">
                  Amount received
                </label>
                <input
                  id="paymentAmount"
                  type="number"
                  min={0}
                  max={invoice.totalAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                />
                {Number(amount) < invoice.totalAmount && Number(amount) > 0 ? (
                  <p className="mt-1 text-xs text-warning">
                    Partial payment — {formatCurrency(invoice.totalAmount - Number(amount))} will remain due.
                  </p>
                ) : null}
              </div>

              {error ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-danger">
                  <AlertTriangle size={14} /> {error}
                </p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                  Skip for now
                </Button>
                <Button
                  className="flex-1"
                  disabled={!amount || Number(amount) <= 0}
                  isLoading={paymentMutation.isPending}
                  onClick={() => {
                    setError(null);
                    paymentMutation.mutate({ invoiceId: invoice._id, amount: Number(amount), method });
                  }}
                >
                  Confirm payment
                </Button>
              </div>
            </>
          )}

          {step === "done" && invoice && (
            <div className="flex flex-col items-center py-4 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-container text-success">
                <Check size={26} />
              </span>
              <h2 className="mt-4 text-lg font-bold text-text">Sale complete</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                <Receipt size={14} /> {invoice.invoiceNumber} · {invoice.billType === "gst" ? "GST bill" : "Record bill"} ·{" "}
                {invoice.paymentStatus === "paid" ? "Fully paid" : "Partially paid"}
              </p>
              <Button className="mt-5 w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
