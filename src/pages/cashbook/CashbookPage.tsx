import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppSetup } from "../../lib/use-app-setup";
import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronLeft, ChevronRight, Lock, Plus, ReceiptIndianRupee, Trash2, Wallet } from "lucide-react";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { EmptyHelp, Field, LoadingRows, PageGuide, PageIntro, SummaryRow, SummaryTile, inputClass } from "../../components/page/kit";
import { AddExpenseModal } from "../../components/cashbook/AddExpenseModal";
import { closeDay, getDaybook, todayIst } from "../../lib/daybook-api";
import { deleteExpense, listExpenses } from "../../lib/expenses-api";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../lib/api-errors";
import { initialParam } from "../../lib/url-params";
import { showError, showSuccess } from "../../lib/toast";

const METHODS = ["cash", "upi", "bank_transfer", "cheque", "card", "credit", "other"];

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * The day's money in one place, the way a shop closes its galla: sales and
 * money received, everything paid out, and what the cash drawer should hold.
 */
export function CashbookPage() {
  const { t, i18n } = useTranslation();
  const { vocab } = useAppSetup();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIst);
  const [expenseOpen, setExpenseOpen] = useState(() => initialParam("add") === "expense");
  const [counted, setCounted] = useState("");
  const [opening, setOpening] = useState("");
  const [note, setNote] = useState("");
  const isToday = date === todayIst();

  const book = useQuery({ queryKey: ["daybook", date], queryFn: () => getDaybook(date) });
  const dayRange = useMemo(() => {
    const start = new Date(`${date}T00:00:00+05:30`);
    return { from: start.toISOString(), to: new Date(start.getTime() + 86_400_000).toISOString() };
  }, [date]);
  const expenses = useQuery({ queryKey: ["expenses", date], queryFn: () => listExpenses(dayRange) });

  const data = book.data;
  useEffect(() => {
    setCounted(data?.closing ? String(data.closing.countedCash) : "");
    setOpening(data ? String(data.cash.opening) : "");
    setNote(data?.closing?.note ?? "");
  }, [data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["daybook"] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  const closeMutation = useMutation({
    mutationFn: () =>
      closeDay({ date, countedCash: Number(counted) || 0, openingCash: opening === "" ? undefined : Number(opening) || 0, note: note.trim() || undefined }),
    onSuccess: () => {
      refresh();
      showSuccess(t("cashbook.closedToast"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: refresh,
    onError: (err) => showError(errorMessage(err, t)),
  });

  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
  const dateLabel = new Date(`${date}T12:00:00+05:30`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const methodLabel = (m: string) => t(`cashbook.method.${METHODS.includes(m) ? m : "other"}`);

  const openingNum = opening === "" ? (data?.cash.opening ?? 0) : Number(opening) || 0;
  const expected = data ? Math.round((openingNum + data.cash.in - data.cash.out) * 100) / 100 : 0;
  const difference = counted === "" ? null : Math.round(((Number(counted) || 0) - expected) * 100) / 100;

  const outRows = data
    ? ([
        ["suppliers", data.moneyOut.suppliers],
        ["expenses", data.moneyOut.expenses],
        ["refunds", data.moneyOut.refunds],
        ["salaries", data.moneyOut.salaries],
      ] as const)
    : [];

  return (
    <div className="space-y-5">
      <PageIntro text={t("cashbook.intro", { context: vocab })}>
        <Button onClick={() => setExpenseOpen(true)}>
          <Plus size={16} aria-hidden="true" /> {t("cashbook.addExpense")}
        </Button>
      </PageIntro>

      <PageGuide
        storageKey="cashbook"
        title={t("cashbook.guide.title")}
        subtitle={t("cashbook.guide.subtitle", { context: vocab })}
        stepLabel={(number) => t("sales.guide.step", { number })}
        steps={[
          { icon: ReceiptIndianRupee, title: t("cashbook.guide.s1.title"), body: t("cashbook.guide.s1.body") },
          {
            icon: Wallet,
            title: t("cashbook.guide.s2.title"),
            body: t("cashbook.guide.s2.body"),
            action: { label: t("cashbook.addExpense"), onClick: () => setExpenseOpen(true) },
          },
          { icon: Lock, title: t("cashbook.guide.s3.title", { context: vocab }), body: t("cashbook.guide.s3.body", { context: vocab }) },
        ]}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("cashbook.prevDay")}
          onClick={() => setDate((d) => shiftDate(d, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <label className="relative flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold text-text sm:flex-none sm:px-5">
          {isToday ? `${t("cashbook.today")} · ` : ""}
          {dateLabel}
          <input
            type="date"
            value={date}
            max={todayIst()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label={t("cashbook.pickDate")}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <button
          type="button"
          aria-label={t("cashbook.nextDay")}
          disabled={isToday}
          onClick={() => setDate((d) => shiftDate(d, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {book.isLoading || !data ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <SummaryRow label={t("cashbook.summaryLabel")}>
            <SummaryTile icon={ReceiptIndianRupee} label={t("cashbook.sales")} value={formatMoney(data.sales.total)} detail={t("cashbook.billsCount", { count: data.sales.count })} />
            <SummaryTile icon={ArrowDownLeft} label={t("cashbook.received")} value={formatMoney(data.totals.received)} detail={t("cashbook.receivedDetail")} />
            <SummaryTile icon={ArrowUpRight} label={t("cashbook.paidOut")} value={formatMoney(data.totals.paidOut)} detail={t("cashbook.paidOutDetail")} />
            <SummaryTile icon={Banknote} label={t("cashbook.cashInDrawer", { context: vocab })} value={formatMoney(expected)} detail={t("cashbook.cashInDrawerDetail", { context: vocab })} />
          </SummaryRow>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="text-base font-bold text-text">{t("cashbook.moneyIn")}</h2>
              <p className="text-sm text-text-muted">{t("cashbook.moneyInBody")}</p>
              <dl className="mt-3 divide-y divide-border text-sm">
                {Object.keys(data.moneyIn.sales).length === 0 ? <p className="py-2 text-text-muted">{t("cashbook.nothing")}</p> : null}
                {Object.entries(data.moneyIn.sales).map(([m, v]) => (
                  <div key={m} className="flex justify-between py-2">
                    <dt className="text-text">{methodLabel(m)}</dt>
                    <dd className="font-semibold tabular-nums text-text">{formatMoney(v)}</dd>
                  </div>
                ))}
              </dl>
              {data.returns.count > 0 ? (
                <p className="mt-2 text-xs text-text-muted">{t("cashbook.returnsNote", { count: data.returns.count, amount: formatMoney(data.returns.total) })}</p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <h2 className="text-base font-bold text-text">{t("cashbook.moneyOut")}</h2>
              <p className="text-sm text-text-muted">{t("cashbook.moneyOutBody")}</p>
              <dl className="mt-3 divide-y divide-border text-sm">
                {outRows.every(([, m]) => Object.keys(m).length === 0) ? <p className="py-2 text-text-muted">{t("cashbook.nothing")}</p> : null}
                {outRows.flatMap(([kind, byMethod]) =>
                  Object.entries(byMethod).map(([m, v]) => (
                    <div key={`${kind}-${m}`} className="flex justify-between gap-3 py-2">
                      <dt className="text-text">
                        {t(`cashbook.out.${kind}`)} <span className="text-text-muted">· {methodLabel(m)}</span>
                      </dt>
                      <dd className="font-semibold tabular-nums text-text">{formatMoney(v)}</dd>
                    </div>
                  ))
                )}
              </dl>
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-text">{t("cashbook.closeTitle")}</h2>
                <p className="text-sm text-text-muted">{t("cashbook.closeBody", { context: vocab })}</p>
              </div>
              {data.closing ? (
                <span className="rounded-full bg-surface-variant px-2.5 py-1 text-xs font-bold text-text">{t("cashbook.closedBadge")}</span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label={t("cashbook.opening")} hint={data.cash.openingFrom && data.cash.openingFrom !== "saved" ? t("cashbook.openingFrom", { date: data.cash.openingFrom }) : t("cashbook.openingHint", { context: vocab })} htmlFor="cb-opening">
                <input id="cb-opening" type="number" inputMode="decimal" min={0} className={inputClass} value={opening} onChange={(e) => setOpening(e.target.value)} />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-text">{t("cashbook.expected", { context: vocab })}</span>
                <p className="flex h-11 items-center rounded-xl bg-surface-muted px-3 text-base font-bold tabular-nums text-text">{formatMoney(expected)}</p>
                <p className="text-xs text-text-muted">{t("cashbook.expectedHint", { in: formatMoney(data.cash.in), out: formatMoney(data.cash.out) })}</p>
              </div>
              <Field label={t("cashbook.counted")} hint={t("cashbook.countedHint", { context: vocab })} htmlFor="cb-counted">
                <input id="cb-counted" type="number" inputMode="decimal" min={0} className={inputClass} value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" />
              </Field>
            </div>

            {difference !== null ? (
              <p
                className={clsx(
                  "mt-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold",
                  difference === 0 ? "bg-surface-muted text-text" : difference > 0 ? "bg-surface-muted text-success" : "bg-surface-muted text-danger"
                )}
                role="status"
              >
                {difference === 0
                  ? t("cashbook.matches")
                  : difference > 0
                    ? t("cashbook.extra", { amount: formatMoney(difference), context: vocab })
                    : t("cashbook.short", { amount: formatMoney(Math.abs(difference)) })}
              </p>
            ) : null}

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label={t("cashbook.note")} htmlFor="cb-note">
                  <input id="cb-note" className={inputClass} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("cashbook.notePlaceholder")} />
                </Field>
              </div>
              <Button disabled={counted === ""} isLoading={closeMutation.isPending} onClick={() => closeMutation.mutate()}>
                <Lock size={15} aria-hidden="true" /> {data.closing ? t("cashbook.updateClose") : t("cashbook.closeDay")}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-text">{t("cashbook.expensesTitle")}</h2>
                <p className="text-sm text-text-muted">{t("cashbook.expensesBody", { context: vocab })}</p>
              </div>
              <Button variant="secondary" onClick={() => setExpenseOpen(true)}>
                <Plus size={15} aria-hidden="true" /> {t("cashbook.add")}
              </Button>
            </div>
            {expenses.isLoading ? (
              <LoadingRows rows={2} />
            ) : (expenses.data ?? []).length === 0 ? (
              <div className="mt-3">
                <EmptyHelp icon={Wallet} title={t("cashbook.noExpenses")} body={t("cashbook.noExpensesBody")} />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {(expenses.data ?? []).map((e) => (
                  <li key={e._id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{t(`expenses.category.${e.category}`, { context: vocab })}</p>
                      <p className="truncate text-xs text-text-muted">
                        {methodLabel(e.method)}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-sm font-bold tabular-nums text-text">{formatMoney(e.amount)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t("cashbook.deleteConfirm"))) deleteMutation.mutate(e._id);
                        }}
                        aria-label={t("cashbook.deleteExpense")}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-icon outline-none hover:bg-surface-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <AddExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} defaultDate={date} onSaved={refresh} />
    </div>
  );
}
