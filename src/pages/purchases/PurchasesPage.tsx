import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2, CalendarDays, FileText, PackagePlus, Phone, Plus, Truck, Wallet, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/SearchInput";
import {
  EmptyHelp,
  FilterChips,
  LoadingRows,
  PageGuide,
  PageIntro,
  StatusPill,
  SummaryRow, SummaryTile,
  TableShell,
  Th,
} from "../../components/page/kit";
import { NewPurchaseModal } from "../../components/purchases/NewPurchaseModal";
import { PurchaseDetailModal } from "../../components/purchases/PurchaseDetailModal";
import { listPurchases, purchaseStatusTone, supplierOf, type Purchase } from "../../lib/purchases-api";
import { listSuppliers } from "../../lib/suppliers-api";
import type { PaymentMethod } from "../../lib/invoices-api";
import { formatCurrency } from "../../lib/format";
import { indianMobile } from "../../lib/phone";
import { initialParam } from "../../lib/url-params";

type Tab = "purchases" | "payments";
type DateRange = "all" | "today" | "week" | "month";
type StatusFilter = "all" | "due" | "paid";

const DAY_MS = 24 * 60 * 60 * 1000;
function rangeStart(range: DateRange, now: Date): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (range === "today") return today.getTime();
  if (range === "week") return today.getTime() - 6 * DAY_MS;
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return 0;
}
const balanceOf = (p: Purchase) => Math.max(0, p.totalAmount - p.amountPaid);

export function PurchasesPage() {
  const { t, i18n } = useTranslation();
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [tab, setTab] = useState<Tab>("purchases");
  const [search, setSearch] = useState(() => initialParam("q"));
  const [range, setRange] = useState<DateRange>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [method, setMethod] = useState<"all" | PaymentMethod>("all");
  const [now] = useState(() => new Date());

  const purchasesQuery = useQuery({ queryKey: ["purchases"], queryFn: listPurchases });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const purchases = useMemo(() => purchasesQuery.data ?? [], [purchasesQuery.data]);

  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  const summary = useMemo(() => {
    const today = rangeStart("today", now);
    const month = rangeStart("month", now);
    const due = purchases.filter((p) => balanceOf(p) > 0);
    return {
      month: purchases.filter((p) => new Date(p.purchasedAt).getTime() >= month).reduce((s, p) => s + p.totalAmount, 0),
      todayTotal: purchases.filter((p) => new Date(p.purchasedAt).getTime() >= today).reduce((s, p) => s + p.totalAmount, 0),
      dueTotal: due.reduce((s, p) => s + balanceOf(p), 0),
      dueCount: due.length,
      dueSuppliers: new Set(due.map((p) => supplierOf(p)._id)).size,
    };
  }, [purchases, now]);

  const payments = useMemo(
    () =>
      purchases
        .flatMap((purchase) => purchase.payments.map((payment, i) => ({ key: `${purchase._id}-${i}`, purchase, ...payment })))
        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
    [purchases]
  );

  const query = search.trim().toLowerCase();
  const since = rangeStart(range, now);
  const matches = (p: Purchase) => {
    if (!query) return true;
    const supplier = supplierOf(p);
    return `${supplier.name} ${supplier.phone ?? ""} ${p.purchaseNumber} ${p.supplierBillNumber ?? ""} ${p.items.map((i) => i.productName).join(" ")}`
      .toLowerCase()
      .includes(query);
  };
  const visiblePurchases = purchases.filter(
    (p) =>
      new Date(p.purchasedAt).getTime() >= since &&
      matches(p) &&
      (status === "all" || (status === "due" && balanceOf(p) > 0) || (status === "paid" && balanceOf(p) === 0))
  );
  const visiblePayments = payments.filter(
    (p) => new Date(p.paidAt).getTime() >= since && matches(p.purchase) && (method === "all" || p.method === method)
  );

  const tabs: { key: Tab; label: string; count: number; icon: LucideIcon }[] = [
    { key: "purchases", label: t("purchases.page.tabs.purchases"), count: purchases.length, icon: Truck },
    { key: "payments", label: t("purchases.page.tabs.payments"), count: payments.length, icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      <PageIntro text={t("purchases.page.intro")}>
        <Button onClick={() => setNewOpen(true)}>
          <Plus size={16} className="mr-1.5" aria-hidden="true" />
          {t("purchases.page.newPurchase")}
        </Button>
      </PageIntro>

      <SummaryRow>
        <SummaryTile
          label={t("purchases.page.summary.month")}
          value={formatCurrency(summary.month)}
          detail={t("purchases.page.summary.monthDetail")}
          icon={CalendarDays}
          tone="primary"
          onClick={() => {
            setTab("purchases");
            setRange("month");
            setStatus("all");
          }}
        />
        <SummaryTile
          label={t("purchases.page.summary.toPay")}
          value={formatCurrency(summary.dueTotal)}
          detail={t("purchases.page.summary.toPayDetail", { count: summary.dueSuppliers })}
          icon={Wallet}
          tone="danger"
          onClick={() => {
            setTab("purchases");
            setRange("all");
            setStatus("due");
          }}
        />
        <SummaryTile
          label={t("purchases.page.summary.today")}
          value={formatCurrency(summary.todayTotal)}
          detail={t("purchases.page.summary.todayDetail")}
          icon={PackagePlus}
          tone="success"
          onClick={() => {
            setTab("purchases");
            setRange("today");
            setStatus("all");
          }}
        />
        <SummaryTile
          label={t("purchases.page.summary.suppliers")}
          value={String(suppliersQuery.data?.length ?? 0)}
          detail={t("purchases.page.summary.suppliersDetail")}
          icon={Building2}
          tone="info"
        />
      </SummaryRow>

      <PageGuide
        storageKey="purchases"
        title={t("purchases.guide.title")}
        subtitle={t("purchases.guide.subtitle")}
        stepLabel={(number) => t("sales.guide.step", { number })}
        steps={[
          { icon: Building2, tone: "info", title: t("purchases.guide.supplier.title"), body: t("purchases.guide.supplier.body") },
          {
            icon: FileText,
            tone: "primary",
            title: t("purchases.guide.record.title"),
            body: t("purchases.guide.record.body"),
            action: { label: t("purchases.page.newPurchase"), onClick: () => setNewOpen(true) },
          },
          { icon: PackagePlus, tone: "success", title: t("purchases.guide.stock.title"), body: t("purchases.guide.stock.body") },
          { icon: Wallet, tone: "warning", title: t("purchases.guide.pay.title"), body: t("purchases.guide.pay.body") },
        ]}
        terms={[
          { term: t("purchases.guide.terms.purchase"), meaning: t("purchases.guide.terms.purchaseMeaning") },
          { term: t("purchases.guide.terms.toPay"), meaning: t("purchases.guide.terms.toPayMeaning") },
          { term: t("purchases.guide.terms.cost"), meaning: t("purchases.guide.terms.costMeaning") },
        ]}
      />

      <div>
        <div role="tablist" aria-label={t("purchases.page.tabsLabel")} className="flex gap-1 rounded-2xl bg-surface-variant p-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={item.key === tab}
              onClick={() => setTab(item.key)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                item.key === tab ? "bg-surface text-text shadow-elevation-1" : "text-text-muted hover:text-text"
              )}
            >
              <item.icon size={17} aria-hidden="true" />
              {item.label}
              <span className="rounded-full bg-surface-variant px-2 text-xs tabular-nums text-text">{item.count}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-text-muted">{t(`purchases.page.tabHelp.${tab}`)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("purchases.page.search")} className="w-full sm:w-72" />
        <FilterChips
          label={t("sales.hub.dateLabel")}
          value={range}
          onChange={setRange}
          options={(["all", "today", "week", "month"] as const).map((key) => ({ key, label: t(`sales.hub.range.${key}`) }))}
        />
        <div className="lg:ml-auto">
          {tab === "purchases" ? (
            <FilterChips
              label={t("sales.hub.statusLabel")}
              value={status}
              onChange={setStatus}
              options={[
                { key: "all", label: t("purchases.page.filter.all") },
                { key: "due", label: t("purchases.page.filter.due"), count: summary.dueCount },
                { key: "paid", label: t("purchases.page.filter.paid") },
              ]}
            />
          ) : (
            <FilterChips
              label={t("sales.hub.methodLabel")}
              value={method}
              onChange={setMethod}
              options={(["all", "cash", "upi", "bank_transfer", "cheque"] as const).map((key) => ({
                key,
                label: key === "all" ? t("sales.hub.allMethods") : t(`sales.hub.method.${key}`),
              }))}
            />
          )}
        </div>
      </div>

      {purchasesQuery.isLoading ? (
        <LoadingRows />
      ) : tab === "purchases" ? (
        purchases.length === 0 ? (
          <EmptyHelp
            icon={Truck}
            title={t("purchases.page.empty.title")}
            body={t("purchases.page.empty.body")}
            action={<Button onClick={() => setNewOpen(true)}>{t("purchases.page.newPurchase")}</Button>}
          />
        ) : visiblePurchases.length === 0 ? (
          <EmptyHelp icon={FileText} title={t("sales.hub.empty.noMatchTitle")} body={t("sales.hub.empty.noMatchBody")} />
        ) : (
          <TableShell
            footer={
              <>
                <span className="text-text-muted">{t("purchases.page.footer.count", { count: visiblePurchases.length })}</span>
                <span className="text-text">
                  {t("sales.hub.footer.total")}: <strong>{formatCurrency(visiblePurchases.reduce((s, p) => s + p.totalAmount, 0))}</strong>
                </span>
                <span className="text-danger">
                  {t("purchases.page.footer.toPay")}: <strong>{formatCurrency(visiblePurchases.reduce((s, p) => s + balanceOf(p), 0))}</strong>
                </span>
              </>
            }
          >
            <thead>
              <tr className="border-b border-border">
                <Th>{t("purchases.page.col.purchase")}</Th>
                <Th>{t("purchases.page.col.supplier")}</Th>
                <Th>{t("purchases.page.col.items")}</Th>
                <Th>{t("sales.salesPage.status")}</Th>
                <Th align="right">{t("sales.salesPage.amount")}</Th>
                <Th align="right">{t("purchases.page.col.toPay")}</Th>
                <Th align="right">{t("sales.hub.col.next")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visiblePurchases.map((purchase) => {
                const supplier = supplierOf(purchase);
                const balance = balanceOf(purchase);
                const mobile = indianMobile(supplier.phone);
                return (
                  <tr key={purchase._id} onClick={() => setSelected(purchase)} className="cursor-pointer hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text">{purchase.purchaseNumber}</p>
                      <p className="text-xs text-text-muted">
                        {formatDate(purchase.purchasedAt)}
                        {purchase.supplierBillNumber ? ` · ${t("purchases.detail.supplierBill", { number: purchase.supplierBillNumber })}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text">{supplier.name}</p>
                      {supplier.phone ? <p className="text-xs text-text-muted">{supplier.phone}</p> : null}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="truncate text-text">{purchase.items.map((i) => i.productName).join(", ")}</p>
                      <p className="text-xs text-text-muted">{t("sales.hub.itemCount", { count: purchase.items.length })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={purchaseStatusTone[purchase.paymentStatus]}>{t(`purchases.status.${purchase.paymentStatus}`)}</StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-text">{formatCurrency(purchase.totalAmount)}</td>
                    <td className={clsx("px-4 py-3 text-right font-bold tabular-nums", balance > 0 ? "text-danger" : "text-text-muted")}>
                      {balance > 0 ? formatCurrency(balance) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {mobile ? (
                          <a
                            href={`tel:+${mobile}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t("dashboard.attention.call", { name: supplier.name })}
                            title={t("dashboard.attention.call", { name: supplier.name })}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            <Phone size={16} aria-hidden="true" />
                          </a>
                        ) : null}
                        {balance > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(purchase);
                            }}
                            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            {t("purchases.page.pay")}
                          </button>
                        ) : (
                          <span className="py-1.5 text-sm font-semibold text-primary">{t("sales.hub.view")}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )
      ) : payments.length === 0 ? (
        <EmptyHelp icon={Wallet} title={t("purchases.page.empty.paymentsTitle")} body={t("purchases.page.empty.paymentsBody")} />
      ) : visiblePayments.length === 0 ? (
        <EmptyHelp icon={FileText} title={t("sales.hub.empty.noMatchTitle")} body={t("sales.hub.empty.noMatchBody")} />
      ) : (
        <TableShell
          footer={
            <>
              <span className="text-text-muted">{t("sales.hub.footer.payments", { count: visiblePayments.length })}</span>
              <span className="font-bold text-text">
                {t("purchases.page.footer.paidOut")}: {formatCurrency(visiblePayments.reduce((s, p) => s + p.amount, 0))}
              </span>
            </>
          }
        >
          <thead>
            <tr className="border-b border-border">
              <Th>{t("sales.salesPage.date")}</Th>
              <Th>{t("purchases.page.col.supplier")}</Th>
              <Th>{t("purchases.page.col.purchase")}</Th>
              <Th>{t("sales.hub.col.method")}</Th>
              <Th align="right">{t("purchases.page.col.paid")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visiblePayments.map((payment) => (
              <tr key={payment.key} onClick={() => setSelected(payment.purchase)} className="cursor-pointer hover:bg-surface-muted">
                <td className="px-4 py-3 text-text">{formatDate(payment.paidAt)}</td>
                <td className="px-4 py-3 font-semibold text-text">{supplierOf(payment.purchase).name}</td>
                <td className="px-4 py-3 text-text">{payment.purchase.purchaseNumber}</td>
                <td className="px-4 py-3">
                  <StatusPill tone="neutral">{t(`sales.hub.method.${payment.method}`)}</StatusPill>
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-text">{formatCurrency(payment.amount)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <NewPurchaseModal open={newOpen} onClose={() => setNewOpen(false)} />
      <PurchaseDetailModal purchase={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
