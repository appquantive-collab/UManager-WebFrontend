import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Check, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { parseOrderText, createOrder, type OrderLineItemInput, type RawMaterialWarning } from "../../lib/orders-api";
import { listCustomers, createCustomer, type CustomerListItem } from "../../lib/customers-api";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import i18n from "../../lib/i18n";

const newCustomerSchema = z.object({
  name: z.string().min(1, i18n.t("orders.common.nameRequired")),
  phone: z.string().optional(),
});
type NewCustomerValues = z.infer<typeof newCustomerSchema>;

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

type Mode = "choose" | "ai" | "manual" | "review" | "warning";

export function NewOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("choose");
  const [orderText, setOrderText] = useState("");

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [rawTextForSave, setRawTextForSave] = useState<string | undefined>(undefined);
  const [source, setSource] = useState<"manual" | "ai_parsed">("manual");
  const [rawMaterialWarnings, setRawMaterialWarnings] = useState<RawMaterialWarning[]>([]);

  const {
    register: registerNewCustomer,
    handleSubmit: handleNewCustomerSubmit,
    reset: resetNewCustomerForm,
    setValue: setNewCustomerValue,
    formState: { errors: newCustomerErrors },
  } = useForm<NewCustomerValues>({
    resolver: zodResolver(newCustomerSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { name: "", phone: "" },
  });

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
      showError(err instanceof ApiError ? err.message : t("orders.newOrderModal.couldNotParse"));
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(customer._id);
      setShowNewCustomerForm(false);
      setShowCustomerPicker(false);
      resetNewCustomerForm({ name: "", phone: "" });
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("orders.common.couldNotAddCustomer"));
    },
  });

  const saveOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (result.rawMaterialWarnings.length > 0) {
        setRawMaterialWarnings(result.rawMaterialWarnings);
        setMode("warning");
      } else {
        resetAndClose();
      }
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("orders.newOrderModal.couldNotSaveOrder"));
    },
  });

  useEffect(() => {
    if (!open) {
      setMode("choose");
      setOrderText("");
      setCustomerId(null);
      setCustomerQuery("");
      setShowCustomerPicker(false);
      setShowNewCustomerForm(false);
      resetNewCustomerForm({ name: "", phone: "" });
      setItems([]);
      setRawMaterialWarnings([]);
    }
  }, [open, resetNewCustomerForm]);

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
          aria-label={t("common.close")}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto p-6">
          {mode === "choose" && (
            <>
              <h2 className="text-lg font-bold text-text">{t("orders.newOrderModal.title")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("orders.newOrderModal.subtitle")}</p>

              <button
                type="button"
                onClick={() => setMode("ai")}
                className="mt-5 flex w-full items-start gap-3 rounded-xl border border-primary/30 bg-primary-container/40 p-4 text-left outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <Sparkles size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text">{t("orders.newOrderModal.typeOrPaste")}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {t("orders.newOrderModal.typeOrPasteExample")}
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
                  <span className="block text-sm font-semibold text-text">{t("orders.newOrderModal.fillManually")}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {t("orders.newOrderModal.fillManuallyDescription")}
                  </span>
                </span>
              </button>
            </>
          )}

          {mode === "ai" && (
            <>
              <h2 className="text-lg font-bold text-text">{t("orders.newOrderModal.aiTitle")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("orders.newOrderModal.aiSubtitle")}</p>

              <textarea
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                rows={6}
                placeholder={t("orders.newOrderModal.aiTextareaPlaceholder")}
                className="mt-4 w-full resize-none rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary"
              />

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setMode("choose")}>
                  {t("common.back")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={orderText.trim().length < 3}
                  isLoading={parseMutation.isPending}
                  onClick={() => parseMutation.mutate(orderText.trim())}
                >
                  {t("orders.newOrderModal.parseOrder")}
                </Button>
              </div>
            </>
          )}

          {mode === "review" && (
            <>
              <h2 className="text-lg font-bold text-text">
                {source === "ai_parsed" ? t("orders.newOrderModal.reviewParsedOrder") : t("orders.newOrderModal.newOrder")}
              </h2>
              <p className="mt-1 text-sm text-text-muted">{t("orders.newOrderModal.reviewSubtitle")}</p>

              <div className="mt-5">
                <p className="mb-1.5 text-sm font-medium text-text-muted">{t("orders.newOrderModal.customer")}</p>
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
                      {t("orders.newOrderModal.change")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCustomerPicker(true)}
                    className="flex w-full items-center gap-2 rounded-lg border border-warning bg-warning-container/40 px-3.5 py-2.5 text-left text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <AlertTriangle size={15} className="shrink-0 text-warning" />
                    {t("orders.newOrderModal.selectOrAddCustomer")}
                  </button>
                )}

                {showCustomerPicker && (
                  <div className="mt-2 rounded-lg border border-border bg-surface p-3">
                    <TextField
                      label={t("orders.common.searchCustomers")}
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder={t("orders.common.typeAName")}
                      autoFocus
                    />
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                      {customersQuery.data?.map((c: CustomerListItem) => (
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
                        <p className="px-2.5 py-2 text-sm text-text-muted">{t("common.noMatches")}</p>
                      )}
                    </div>

                    {!showNewCustomerForm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCustomerForm(true);
                          setNewCustomerValue("name", customerQuery);
                        }}
                        className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Plus size={14} /> {t("orders.common.addNewCustomer")}
                      </button>
                    ) : (
                      <form
                        className="mt-2 space-y-2 border-t border-border pt-2"
                        onSubmit={handleNewCustomerSubmit((values) =>
                          createCustomerMutation.mutate({
                            name: values.name.trim(),
                            phone: values.phone?.trim() || undefined,
                          })
                        )}
                        noValidate
                      >
                        <TextField label={t("common.name")} error={newCustomerErrors.name?.message} {...registerNewCustomer("name")} />
                        <TextField
                          label={t("orders.common.phoneOptional")}
                          error={newCustomerErrors.phone?.message}
                          {...registerNewCustomer("phone")}
                        />
                        <Button type="submit" className="w-full" isLoading={createCustomerMutation.isPending}>
                          {t("orders.common.saveCustomer")}
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-text-muted">{t("orders.newOrderModal.items", { count: items.length })}</p>
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
                            <AlertTriangle size={12} /> {t("orders.newOrderModal.newProduct")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-success">
                            <Check size={12} /> {t("orders.newOrderModal.matched")}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={t("orders.common.removeItem")}
                          className="rounded-full p-1 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <input
                        value={item.productName}
                        onChange={(e) => updateItem(item.key, { productName: e.target.value })}
                        placeholder={t("orders.common.productNamePlaceholder")}
                        className="mt-2 w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
                      />

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-text-muted">{t("orders.common.qty")}</label>
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
                          <label className="text-xs text-text-muted">{t("orders.common.unit")}</label>
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
                            {t("orders.common.price")} {item.isNewProduct ? "*" : ""}
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
                  <Plus size={14} /> {t("orders.common.addItem")}
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-surface-variant px-3.5 py-2.5">
                <span className="text-sm font-medium text-text-muted">{t("common.total")}</span>
                <span className="text-base font-bold text-text">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={resetAndClose}>
                  {t("common.cancel")}
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
                    t("orders.newOrderModal.saveOrder")
                  )}
                </Button>
              </div>
            </>
          )}

          {mode === "warning" && (
            <>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-container text-warning">
                  <AlertTriangle size={18} />
                </span>
                <h2 className="text-lg font-bold text-text">{t("orders.newOrderModal.warningTitle")}</h2>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                {t("orders.newOrderModal.warningSubtitle")}
              </p>

              <div className="mt-4 space-y-2">
                {rawMaterialWarnings.map((w) => (
                  <div key={w.productId} className="rounded-lg border border-warning/40 bg-warning-container/20 px-3.5 py-2.5">
                    <p className="text-sm font-medium text-text">{w.productName}</p>
                    <p className="text-xs text-text-muted">
                      {t("orders.newOrderModal.orderedCanMake", { ordered: w.orderedQuantity, producible: w.producibleQuantity })}
                    </p>
                  </div>
                ))}
              </div>

              <Button className="mt-5 w-full" onClick={resetAndClose}>
                {t("orders.newOrderModal.gotIt")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
