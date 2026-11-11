import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Button } from "../ui/Button";
import { Field, ModalShell, inputClass } from "../page/kit";
import { EXPENSE_CATEGORIES, createExpense, type ExpenseCategory, type ExpenseMethod } from "../../lib/expenses-api";
import { todayIst } from "../../lib/daybook-api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

const METHODS: { value: ExpenseMethod; key: string }[] = [
  { value: "cash", key: "cash" },
  { value: "upi", key: "upi" },
  { value: "bank_transfer", key: "bank_transfer" },
];

/** Shop running costs: rent, bijli, chai-paani, transport… */
export function AddExpenseModal({
  open,
  onClose,
  onSaved,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaultDate?: string;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<ExpenseCategory>("tea_food");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ExpenseMethod>("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayIst());

  useEffect(() => {
    if (!open) return;
    setCategory("tea_food");
    setAmount("");
    setMethod("cash");
    setNote("");
    setDate(defaultDate ?? todayIst());
  }, [open, defaultDate]);

  const mutation = useMutation({
    mutationFn: () => {
      // Today → now; another day → midday that day (India time), so it lands on the right page.
      const spentAt = date === todayIst() ? new Date().toISOString() : new Date(`${date}T12:00:00+05:30`).toISOString();
      return createExpense({ category, amount: Number(amount), method, note: note.trim() || undefined, spentAt });
    },
    onSuccess: () => {
      showSuccess(t("cashbook.expenseSaved"));
      onSaved?.();
      onClose();
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const valid = Number(amount) > 0;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t("cashbook.addExpense")}
      subtitle={t("cashbook.addExpenseSub")}
      closeLabel={t("common.close")}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" disabled={!valid} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("cashbook.saveExpense")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-text">{t("cashbook.what")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={clsx(
                  "min-h-10 rounded-full border px-3.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                  category === c ? "border-text bg-text text-surface" : "border-border text-text hover:bg-surface-muted"
                )}
              >
                {t(`expenses.category.${c}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("cashbook.amount")} htmlFor="exp-amount">
            <input
              id="exp-amount"
              type="number"
              inputMode="decimal"
              min={0}
              autoFocus
              className={`${inputClass} text-base font-semibold`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label={t("cashbook.date")} htmlFor="exp-date">
            <input id="exp-date" type="date" max={todayIst()} className={inputClass} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">{t("cashbook.paidFrom")}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={method === m.value}
                onClick={() => setMethod(m.value)}
                className={clsx(
                  "min-h-10 rounded-lg border text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  method === m.value ? "border-text bg-text text-surface" : "border-border text-text hover:bg-surface-muted"
                )}
              >
                {t(`cashbook.method.${m.key}`)}
              </button>
            ))}
          </div>
        </div>
        <Field label={t("cashbook.noteOptional")} htmlFor="exp-note">
          <input id="exp-note" className={inputClass} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("cashbook.expenseNotePlaceholder")} />
        </Field>
      </div>
    </ModalShell>
  );
}
