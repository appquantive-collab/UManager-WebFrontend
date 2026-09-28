import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Check, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { parseOrderText, createOrder, type OrderLineItemInput } from "../../lib/orders-api";
import { listCustomers, createCustomer, type Customer } from "../../lib/customers-api";
import { ApiError } from "../../lib/api";

interface DraftItem extends OrderLineItemInput {
  key: string;
}

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `item-${keySeq}`;
}

function emptyItem(): DraftItem {
  return { key: nextKey(), productName: "", quantity: 1, unit: "pcs", unitPrice: 0, isNewProduct: true };
}

type Mode = "choose" | "ai" | "manual" | "review";

export function NewOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("choose");
  const [orderText, setOrderText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [rawTextForSave, setRawTextForSave] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<"manual" | "ai_parsed">("manual");
  const [saveError, setSaveError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", customerQuery],
    queryFn: () => listCustomers(customerQuery),
    enabled: showCustomerPicker,
  });

  const selectedCustomerQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => listCustomers(),
    enabled: open,
  });
  const selectedCustomer = selectedCustomerQuery.data?.find((c) => c._id === customerId) ?? null;

  const parseMutation = useMutation({
    mutationFn: parseOrderText,
    onSuccess: (preview) => {
      setParseError(null);
      setItems(
        preview.items.map((i) => ({
          key: nextKey(),
          productId: i.productId ?? undefined,
          productName: i.productName,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          isNewProduct: i.isNewProduct,
        }))
      );
      if (preview.matchedCustomers.length === 1) {
        setCustomerId(preview.matchedCustomers[0].id);
      } else {
        setCustomerId(null);
      }
      setRawTextForSave(orderText);
      setSource("ai_parsed");
      setMode("review");
    },
    onError: (err) => {
      setParseError(err instanceof ApiError ? err.message : "Couldn't parse that text. Try again or fill manually.");
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(customer._id);
      setShowNewCustomerForm(false);
      setShowCustomerPicker(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
    },
  });

  const saveOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      resetAndClose();
    },
    onError: (err) => {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save the order. Please try again.");
    },
  });

  useEffect(() => {
    if (!open) {
      setMode("choose");
      setOrderText("");
      setParseError(null);
      setCustomerId(null);
      setCustomerQuery("");
      setShowCustomerPicker(false);
      setShowNewCustomerForm(false);
      setItems([]);
      setSaveError(null);
    }
  }, [open]);

  if (!open) return null;

  const resetAndClose = () => {
    onClose();
  };

  const startManual = () => {
    setItems([emptyItem()]);
    setSource("manual");
    setRawTextForSave(undefined);
    setMode("review");
  };

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const removeItem = (key: string) => {
    setItems((current) => current.filter((it) => it.key !== key));
  };

  const addBlankItem = () => {
    setItems((current) => [...current, emptyItem()]);
  };

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

  const hasZeroPriceNewItem = items.some((i) => i.isNewProduct && (!i.unitPrice || i.unitPrice <= 0));
  const canSave =
    Boolean(customerId) && items.length > 0 && items.every((i) => i.productName.trim() && i.quantity > 0) && !hasZeroPriceNewItem;

  const handleSave = () => {
    if (!customerId) return;
    setSaveError(null);
    saveOrderMutation.mutate({
      customerId,
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName.trim(),
        quantity: Number(i.quantity),
        unit: i.unit || "pcs",
        unitPrice: Number(i.unitPrice) || 0,
        isNewProduct: i.isNewProduct,
      })),
      source,
      rawText: rawTextForSave,
    });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-surface shadow-elevation-3">
        <button
          type="button"
          onClick={resetAndClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto p-6">
          {mode === "choose" && (
            <>
              <h2 className="text-lg font-bold text-text">New order</h2>
              <p className="mt-1 text-sm text-text-muted">Paste what the party told you, or fill in a form.</p>

              <button
                type="button"
                onClick={() => setMode("ai")}
                className="mt-5 flex w-full items-start gap-3 rounded-xl border border-primary/30 bg-primary-container/40 p-4 text-left outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <Sparkles size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text">Type or paste the order</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    e.g. "Rajesh Musical se 25 dholak, 20 bongo..." — AI figures out the party and items.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={startManual}
                className="mt-3 flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-variant text-text">
                  <Plus size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text">Fill in manually</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    Pick a customer and add items one by one.
                  </span>
                </span>
              </button>
            </>
          )}

          {mode === "ai" && (
            <>
              <h2 className="text-lg font-bold text-text">Type the order</h2>
              <p className="mt-1 text-sm text-text-muted">Write it the way you'd say it — Hindi, English, or mixed.</p>

              <textarea
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                rows={6}
                placeholder="new order aaya hai Rajesh Musical se 25 aam ki lakdhi ki dholak natbold wali, 20 bongo full ready, 200 damru 5 inchi wale"
                className="mt-4 w-full resize-none rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
              />

              {parseError ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-danger">
                  <AlertTriangle size={14} /> {parseError}
                </p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setMode("choose")}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={orderText.trim().length < 3}
                  isLoading={parseMutation.isPending}
                  onClick={() => {
                    setParseError(null);
                    parseMutation.mutate(orderText.trim());
                  }}
                >
                  Parse order
                </Button>
              </div>
            </>
          )}

          {mode === "review" && (
            <>
              <h2 className="text-lg font-bold text-text">
                {source === "ai_parsed" ? "Review parsed order" : "New order"}
              </h2>
              <p className="mt-1 text-sm text-text-muted">Confirm the customer and items before saving.</p>

              <div className="mt-5">
                <p className="mb-1.5 text-sm font-medium text-text-muted">Customer</p>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-surface-variant px-3.5 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-text">{selectedCustomer.name}</p>
                      {selectedCustomer.phone ? (
                        <p className="text-xs text-text-muted">{selectedCustomer.phone}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustomerPicker(true)}
                      className="text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCustomerPicker(true)}
                    className="flex w-full items-center gap-2 rounded-lg border border-warning bg-warning-container/40 px-3.5 py-2.5 text-left text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <AlertTriangle size={15} className="shrink-0 text-warning" />
                    Select or add a customer
                  </button>
                )}

                {showCustomerPicker && (
                  <div className="mt-2 rounded-lg border border-border bg-surface p-3">
                    <TextField
                      label="Search customers"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Type a name…"
                      autoFocus
                    />
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                      {customersQuery.data?.map((c: Customer) => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => {
                            setCustomerId(c._id);
                            setShowCustomerPicker(false);
                          }}
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <span className="font-medium text-text">{c.name}</span>
                          {c.phone ? <span className="text-xs text-text-muted">{c.phone}</span> : null}
                        </button>
                      ))}
                      {customersQuery.data?.length === 0 && (
                        <p className="px-2.5 py-2 text-sm text-text-muted">No matches.</p>
                      )}
                    </div>

                    {!showNewCustomerForm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCustomerForm(true);
                          setNewCustomerName(customerQuery);
                        }}
                        className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Plus size={14} /> Add new customer
                      </button>
                    ) : (
                      <div className="mt-2 space-y-2 border-t border-border pt-2">
                        <TextField
                          label="Name"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                        />
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
                          Save customer
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-muted">Items ({items.length})</p>
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className={clsx(
                        "rounded-xl border p-3",
                        item.isNewProduct ? "border-warning/50 bg-warning-container/20" : "border-border bg-surface"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {item.isNewProduct ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-warning">
                            <AlertTriangle size={12} /> New product
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-success">
                            <Check size={12} /> Matched
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
                              item.isNewProduct && (!item.unitPrice || item.unitPrice <= 0)
                                ? "font-semibold text-danger"
                                : "text-text-muted"
                            )}
                          >
                            Price {item.isNewProduct ? "*" : ""}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.key, { unitPrice: Number(e.target.value) })}
                            className={clsx(
                              "mt-0.5 w-full rounded-lg border bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary",
                              item.isNewProduct && (!item.unitPrice || item.unitPrice <= 0)
                                ? "border-danger"
                                : "border-transparent"
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
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-surface-variant px-3.5 py-2.5">
                <span className="text-sm font-medium text-text-muted">Total</span>
                <span className="text-base font-bold text-text">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </span>
              </div>

              {saveError ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-danger">
                  <AlertTriangle size={14} /> {saveError}
                </p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={resetAndClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canSave}
                  isLoading={saveOrderMutation.isPending}
                  onClick={handleSave}
                >
                  {saveOrderMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Save order"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
