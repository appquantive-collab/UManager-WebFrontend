import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppSetup } from "../../lib/use-app-setup";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Boxes, Download, FileSpreadsheet, IndianRupee, Landmark, Percent, Plus, ReceiptText, Truck, Wallet } from "lucide-react";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { ProBadge, useProGate } from "../../components/ui/ProBadge";
import { AddExpenseModal } from "../../components/cashbook/AddExpenseModal";
import { EmptyHelp, FilterChips, LoadingRows, PageIntro, SummaryRow, SummaryTile, TableShell, Th } from "../../components/page/kit";
import { formatCurrency } from "../../lib/format";
import { outT, printInEnglish } from "../../lib/output-lang";
import { isCancelled, listInvoices, type Invoice } from "../../lib/invoices-api";
import { listExpenses } from "../../lib/expenses-api";
import { listReturns } from "../../lib/returns-api";
import { listPurchases, supplierOf, type Purchase } from "../../lib/purchases-api";
import { listProducts } from "../../lib/products-api";
import { getStockLevels } from "../../lib/stock-api";
import { listCustomers } from "../../lib/customers-api";
import { listSuppliers } from "../../lib/suppliers-api";

// Business reports built from real records: bills, purchases, products/stock,
// customer and supplier balances. Every table can be downloaded as CSV.

type Report = "sales" | "purchases" | "profit" | "stock" | "dues" | "gst";
type Period = "today" | "week" | "month" | "lastMonth" | "fy";

const DAY_MS = 24 * 60 * 60 * 1000;

function periodRange(period: Period, now: Date): [number, number] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = now.getTime() + 1;
  if (period === "today") return [today.getTime(), end];
  if (period === "week") return [today.getTime() - 6 * DAY_MS, end];
  if (period === "month") return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end];
  if (period === "lastMonth") return [new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()];
  // Indian financial year starts on 1 April.
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [new Date(fyStartYear, 3, 1).getTime(), end];
}

const inRange = (iso: string, [from, to]: [number, number]) => {
  const time = new Date(iso).getTime();
  return time >= from && time < to;
};

const customerName = (invoice: Invoice) => (typeof invoice.customerId === "string" ? "—" : invoice.customerId.name);

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // BOM so Excel opens Hindi names correctly.
  const blob = new Blob(["﻿" + rows.map((r) => r.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Section({ title, onExport, exportLabel, pro, children }: { title: string; onExport?: () => void; exportLabel?: string; pro?: boolean; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-text">{title}</h2>
        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary outline-none hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Download size={15} aria-hidden="true" />
            {exportLabel}
            {pro ? <ProBadge /> : null}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RankTable({ head, rows, emptyText }: { head: [string, string, string]; rows: { name: string; detail: string; amount: number }[]; emptyText: string }) {
  if (rows.length === 0) return <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-text-muted">{emptyText}</p>;
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <TableShell>
      <thead>
        <tr className="border-b border-border">
          <Th>{head[0]}</Th>
          <Th>{head[1]}</Th>
          <Th align="right">{head[2]}</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row, i) => (
          <tr key={`${row.name}-${i}`}>
            <td className="px-4 py-3">
              <p className="font-semibold text-text">
                <span className="mr-2 text-xs font-bold text-text-muted">{i + 1}.</span>
                {row.name}
              </p>
              <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-surface-variant">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(row.amount / max) * 100}%` }} />
              </div>
            </td>
            <td className="px-4 py-3 text-text-muted">{row.detail}</td>
            <td className="px-4 py-3 text-right font-bold tabular-nums text-text">{formatCurrency(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { vocab } = useAppSetup();
  const [report, setReport] = useState<Report>("sales");
  const [period, setPeriod] = useState<Period>("month");
  const [now] = useState(() => new Date());
  const [expenseOpen, setExpenseOpen] = useState(false);
  const proGate = useProGate();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";

  const invoicesQuery = useQuery({ queryKey: ["invoices"], queryFn: listInvoices });
  const purchasesQuery = useQuery({ queryKey: ["purchases"], queryFn: listPurchases });
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });
  const stockQuery = useQuery({ queryKey: ["stock-levels"], queryFn: getStockLevels });
  const customersQuery = useQuery({ queryKey: ["customers", "all"], queryFn: () => listCustomers() });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const expensesQuery = useQuery({ queryKey: ["expenses", "all"], queryFn: () => listExpenses() });
  const returnsQuery = useQuery({ queryKey: ["returns"], queryFn: listReturns });

  const range = useMemo(() => periodRange(period, now), [period, now]);
  // Cancelled bills are left out of every report.
  const activeInvoices = useMemo(() => (invoicesQuery.data ?? []).filter((i) => !isCancelled(i)), [invoicesQuery.data]);
  const invoices = useMemo(() => activeInvoices.filter((i) => inRange(i.createdAt, range)), [activeInvoices, range]);
  const purchases = useMemo(() => (purchasesQuery.data ?? []).filter((p) => inRange(p.purchasedAt, range)), [purchasesQuery.data, range]);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const productById = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const stock = useMemo(() => stockQuery.data ?? {}, [stockQuery.data]);

  const exportName = (name: string) => `sethsathi-${name}-${period}.csv`;
  const periodLabel = t(`reports.hub.period.${period}`);

  // ---- Sales
  const sales = useMemo(() => {
    const total = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const collected = activeInvoices.flatMap((i) => i.payments).filter((p) => p.method !== "credit_note" && inRange(p.paidAt, range)).reduce((s, p) => s + p.amount, 0);
    const byDay = new Map<string, number>();
    for (const i of invoices) {
      const key = new Date(i.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" });
      byDay.set(key, (byDay.get(key) ?? 0) + i.totalAmount);
    }
    const days = [...invoices]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((i) => new Date(i.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" }))
      .filter((d, idx, arr) => arr.indexOf(d) === idx)
      .map((day) => ({ day, sales: byDay.get(day) ?? 0 }));
    const byProduct = new Map<string, { name: string; qty: number; unit: string; amount: number }>();
    for (const i of invoices)
      for (const item of i.items) {
        const row = byProduct.get(item.productId) ?? { name: item.productName, qty: 0, unit: item.unit, amount: 0 };
        row.qty += item.quantity;
        row.amount += item.lineTotal;
        byProduct.set(item.productId, row);
      }
    const byCustomer = new Map<string, { name: string; bills: number; amount: number }>();
    for (const i of invoices) {
      const key = typeof i.customerId === "string" ? i.customerId : i.customerId._id;
      const row = byCustomer.get(key) ?? { name: customerName(i), bills: 0, amount: 0 };
      row.bills += 1;
      row.amount += i.totalAmount;
      byCustomer.set(key, row);
    }
    return {
      total,
      count: invoices.length,
      average: invoices.length ? total / invoices.length : 0,
      collected,
      days,
      topProducts: [...byProduct.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
      topCustomers: [...byCustomer.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
    };
  }, [invoices, activeInvoices, range, locale]);

  // ---- Purchases
  const buying = useMemo(() => {
    const bySupplier = new Map<string, { name: string; count: number; amount: number }>();
    const byItem = new Map<string, { name: string; qty: number; unit: string; amount: number }>();
    for (const p of purchases) {
      const supplier = supplierOf(p);
      const row = bySupplier.get(supplier._id) ?? { name: supplier.name, count: 0, amount: 0 };
      row.count += 1;
      row.amount += p.totalAmount;
      bySupplier.set(supplier._id, row);
      for (const item of p.items) {
        const r = byItem.get(item.productId) ?? { name: item.productName, qty: 0, unit: item.unit, amount: 0 };
        r.qty += item.quantity;
        r.amount += item.lineTotal;
        byItem.set(item.productId, r);
      }
    }
    return {
      total: purchases.reduce((s, p) => s + p.totalAmount, 0),
      count: purchases.length,
      paid: purchases.reduce((s, p) => s + p.amountPaid, 0),
      topSuppliers: [...bySupplier.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
      topItems: [...byItem.values()].sort((a, b) => b.amount - a.amount).slice(0, 10),
    };
  }, [purchases]);

  // ---- Profit (estimate: sales before GST minus current cost price of what was sold)
  const profit = useMemo(() => {
    const byProduct = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    for (const i of invoices)
      for (const item of i.items) {
        const cost = (productById.get(item.productId)?.purchasePrice ?? 0) * item.quantity;
        const row = byProduct.get(item.productId) ?? { name: item.productName, qty: 0, revenue: 0, cost: 0 };
        row.qty += item.quantity;
        row.revenue += item.lineSubtotal;
        row.cost += cost;
        byProduct.set(item.productId, row);
      }
    // Goods that came back: take their value off sales and their cost off cost of goods.
    for (const r of (returnsQuery.data ?? []).filter((x) => inRange(x.createdAt, range)))
      for (const item of r.items) {
        const row = byProduct.get(item.productId);
        if (!row) continue;
        row.qty -= item.quantity;
        row.revenue -= item.unitPrice * item.quantity;
        row.cost -= (productById.get(item.productId)?.purchasePrice ?? 0) * item.quantity;
      }
    const rows = [...byProduct.values()].map((r) => ({ ...r, profit: r.revenue - r.cost })).sort((a, b) => b.profit - a.profit);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const periodExpenses = (expensesQuery.data ?? []).filter((e) => inRange(e.spentAt, range));
    const expenses = periodExpenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = new Map<string, number>();
    for (const e of periodExpenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    return {
      rows,
      revenue,
      cost,
      profit: revenue - cost,
      expenses,
      expenseRows: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      net: revenue - cost - expenses,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    };
  }, [invoices, productById, returnsQuery.data, expensesQuery.data, range]);

  // ---- Stock
  const stockReport = useMemo(() => {
    const soldIds = new Set(invoices.flatMap((i) => i.items.map((item) => item.productId)));
    const rows = products
      .filter((p) => p.isActive)
      .map((p) => {
        const qty = stock[p._id]?.total ?? 0;
        return { name: p.name, unit: p.unit, qty, cost: Math.max(0, qty) * p.purchasePrice, wholesale: Math.max(0, qty) * p.wholesalePrice, sold: soldIds.has(p._id), reorder: p.reorderLevel };
      })
      .sort((a, b) => b.cost - a.cost);
    return {
      rows,
      atCost: rows.reduce((s, r) => s + r.cost, 0),
      atWholesale: rows.reduce((s, r) => s + r.wholesale, 0),
      dead: rows.filter((r) => r.qty > 0 && !r.sold),
      low: rows.filter((r) => r.qty <= r.reorder).length,
    };
  }, [products, stock, invoices]);

  // ---- Dues
  const dues = useMemo(() => {
    const receivable = (customersQuery.data ?? []).filter((c) => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
    const payable = (suppliersQuery.data ?? []).filter((s) => (s.outstanding ?? 0) > 0).sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0));
    return {
      receivable,
      payable,
      toCollect: receivable.reduce((s, c) => s + c.outstanding, 0),
      toPay: payable.reduce((s, x) => s + (x.outstanding ?? 0), 0),
    };
  }, [customersQuery.data, suppliersQuery.data]);

  // ---- GST
  const gst = useMemo(() => {
    const rates = new Map<number, { rate: number; salesTaxable: number; salesTax: number; buyTaxable: number; buyTax: number }>();
    const row = (rate: number) => {
      const existing = rates.get(rate) ?? { rate, salesTaxable: 0, salesTax: 0, buyTaxable: 0, buyTax: 0 };
      rates.set(rate, existing);
      return existing;
    };
    for (const i of invoices.filter((x) => x.billType === "gst"))
      for (const item of i.items) {
        const r = row(item.gstPercent);
        r.salesTaxable += item.lineSubtotal;
        r.salesTax += item.lineTax;
      }
    for (const p of purchases as Purchase[])
      for (const item of p.items) {
        const r = row(item.gstPercent);
        r.buyTaxable += item.lineSubtotal;
        r.buyTax += item.lineTax;
      }
    const rows = [...rates.values()].filter((r) => r.salesTax + r.buyTax > 0 || r.salesTaxable + r.buyTaxable > 0).sort((a, b) => a.rate - b.rate);
    const output = rows.reduce((s, r) => s + r.salesTax, 0);
    const input = rows.reduce((s, r) => s + r.buyTax, 0);
    return { rows, output, input, net: output - input };
  }, [invoices, purchases]);

  const loading = invoicesQuery.isLoading || purchasesQuery.isLoading || productsQuery.isLoading;

  const reports: { key: Report; icon: typeof BarChart3 }[] = [
    { key: "sales", icon: ReceiptText },
    { key: "purchases", icon: Truck },
    { key: "profit", icon: IndianRupee },
    { key: "stock", icon: Boxes },
    { key: "dues", icon: Wallet },
    { key: "gst", icon: Landmark },
  ];

  return (
    <div className="space-y-5">
      <PageIntro text={t("reports.hub.intro")} />

      <div role="tablist" aria-label={t("reports.hub.reportsLabel")} className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {reports.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === report}
            onClick={() => setReport(item.key)}
            className={clsx(
              "flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              item.key === report ? "border-primary bg-primary-container text-on-primary-container" : "border-border bg-surface text-text hover:border-primary/50"
            )}
          >
            <item.icon size={20} aria-hidden="true" />
            {t(`reports.hub.tabs.${item.key}`)}
          </button>
        ))}
      </div>
      <p className="text-sm text-text-muted">{t(`reports.hub.help.${report}`)}</p>

      {report !== "dues" ? (
        <FilterChips
          label={t("reports.hub.periodLabel")}
          value={period}
          onChange={setPeriod}
          options={(["today", "week", "month", "lastMonth", "fy"] as const).map((key) => ({ key, label: t(`reports.hub.period.${key}`) }))}
        />
      ) : null}

      {loading ? (
        <LoadingRows />
      ) : report === "sales" ? (
        <div className="space-y-6">
          <SummaryRow>
            <SummaryTile label={t("reports.hub.sales.total")} value={formatCurrency(sales.total)} detail={periodLabel} icon={ReceiptText} tone="primary" />
            <SummaryTile label={t("reports.hub.sales.bills")} value={String(sales.count)} detail={t("reports.hub.sales.average", { amount: formatCurrency(sales.average) })} icon={FileSpreadsheet} tone="info" />
            <SummaryTile label={t("reports.hub.sales.collected")} value={formatCurrency(sales.collected)} detail={t("reports.hub.sales.collectedDetail")} icon={Wallet} tone="success" />
            <SummaryTile label={t("reports.hub.sales.profit")} value={formatCurrency(profit.profit)} detail={t("reports.hub.profit.marginDetail", { margin: profit.margin.toFixed(1) })} icon={Percent} tone="warning" onClick={() => setReport("profit")} />
          </SummaryRow>

          <Section title={t("reports.hub.sales.byDay")}>
            {sales.days.length === 0 ? (
              <EmptyHelp icon={BarChart3} title={t("reports.hub.empty.title")} body={t("reports.hub.empty.sales")} />
            ) : (
              <div className="h-72 rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales.days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 4" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12, fontWeight: 600 }} />
                    <YAxis
                      width={60}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                      tickFormatter={(v: number) => new Intl.NumberFormat("en-IN", { notation: "compact", style: "currency", currency: "INR", maximumFractionDigits: 1 }).format(v)}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-surface-variant)" }}
                      formatter={(v) => [formatCurrency(Number(v)), t("dashboard.desk.sales")]}
                      contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-text)" }}
                    />
                    <Bar dataKey="sales" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section
              title={t("reports.hub.sales.topProducts")}
              exportLabel={t("reports.hub.download")}
              onExport={() => downloadCsv(exportName("top-products"), [[outT("reports.hub.col.product"), outT("reports.hub.col.qty"), outT("reports.hub.col.amount")], ...sales.topProducts.map((r) => [r.name, `${r.qty} ${r.unit}`, r.amount.toFixed(2)])])}
            >
              <RankTable
                head={[t("reports.hub.col.product"), t("reports.hub.col.qty"), t("reports.hub.col.amount")]}
                rows={sales.topProducts.map((r) => ({ name: r.name, detail: `${r.qty} ${r.unit}`, amount: r.amount }))}
                emptyText={t("reports.hub.empty.sales")}
              />
            </Section>
            <Section
              title={t("reports.hub.sales.topCustomers")}
              exportLabel={t("reports.hub.download")}
              onExport={() => downloadCsv(exportName("top-customers"), [[outT("reports.hub.col.customer"), outT("reports.hub.col.bills"), outT("reports.hub.col.amount")], ...sales.topCustomers.map((r) => [r.name, r.bills, r.amount.toFixed(2)])])}
            >
              <RankTable
                head={[t("reports.hub.col.customer"), t("reports.hub.col.bills"), t("reports.hub.col.amount")]}
                rows={sales.topCustomers.map((r) => ({ name: r.name, detail: t("sales.hub.summary.bills", { count: r.bills }), amount: r.amount }))}
                emptyText={t("reports.hub.empty.sales")}
              />
            </Section>
          </div>
        </div>
      ) : report === "purchases" ? (
        <div className="space-y-6">
          <SummaryRow>
            <SummaryTile label={t("reports.hub.buy.total")} value={formatCurrency(buying.total)} detail={periodLabel} icon={Truck} tone="primary" />
            <SummaryTile label={t("reports.hub.buy.count")} value={String(buying.count)} detail={t("reports.hub.buy.countDetail")} icon={FileSpreadsheet} tone="info" />
            <SummaryTile label={t("reports.hub.buy.paid")} value={formatCurrency(buying.paid)} detail={t("reports.hub.buy.unpaid", { amount: formatCurrency(buying.total - buying.paid) })} icon={Wallet} tone="success" />
          </SummaryRow>
          <div className="grid gap-6 xl:grid-cols-2">
            <Section
              title={t("reports.hub.buy.topSuppliers")}
              exportLabel={t("reports.hub.download")}
              onExport={() => downloadCsv(exportName("top-suppliers"), [[outT("reports.hub.col.supplier"), outT("reports.hub.col.purchases"), outT("reports.hub.col.amount")], ...buying.topSuppliers.map((r) => [r.name, r.count, r.amount.toFixed(2)])])}
            >
              <RankTable
                head={[t("reports.hub.col.supplier"), t("reports.hub.col.purchases"), t("reports.hub.col.amount")]}
                rows={buying.topSuppliers.map((r) => ({ name: r.name, detail: String(r.count), amount: r.amount }))}
                emptyText={t("reports.hub.empty.purchases")}
              />
            </Section>
            <Section
              title={t("reports.hub.buy.topItems")}
              exportLabel={t("reports.hub.download")}
              onExport={() => downloadCsv(exportName("purchased-items"), [[outT("reports.hub.col.product"), outT("reports.hub.col.qty"), outT("reports.hub.col.amount")], ...buying.topItems.map((r) => [r.name, `${r.qty} ${r.unit}`, r.amount.toFixed(2)])])}
            >
              <RankTable
                head={[t("reports.hub.col.product"), t("reports.hub.col.qty"), t("reports.hub.col.amount")]}
                rows={buying.topItems.map((r) => ({ name: r.name, detail: `${r.qty} ${r.unit}`, amount: r.amount }))}
                emptyText={t("reports.hub.empty.purchases")}
              />
            </Section>
          </div>
        </div>
      ) : report === "profit" ? (
        <div className="space-y-6">
          <SummaryRow>
            <SummaryTile label={t("reports.hub.profit.revenue")} value={formatCurrency(profit.revenue)} detail={t("reports.hub.profit.revenueDetail")} icon={ReceiptText} tone="primary" />
            <SummaryTile label={t("reports.hub.profit.cost")} value={formatCurrency(profit.cost)} detail={t("reports.hub.profit.costDetail")} icon={Truck} tone="neutral" />
            <SummaryTile label={t("reports.hub.profit.profit")} value={formatCurrency(profit.profit)} detail={periodLabel} icon={IndianRupee} tone={profit.profit >= 0 ? "success" : "danger"} />
            <SummaryTile label={t("reports.hub.profit.margin")} value={`${profit.margin.toFixed(1)}%`} detail={t("reports.hub.profit.marginHint")} icon={Percent} tone="warning" />
          </SummaryRow>
          <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-text">{t("reportsExtra.netTitle")}</h2>
              {/* Expenses can be added here too, for businesses that keep Rokad bahi switched off. */}
              <Button variant="secondary" onClick={() => setExpenseOpen(true)}>
                <Plus size={15} aria-hidden="true" /> {t("cashbook.addExpense")}
              </Button>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between">
                <dt className="text-text">{t("reportsExtra.grossProfit")}</dt>
                <dd className="font-semibold text-text">{formatCurrency(profit.profit)}</dd>
              </div>
              {profit.expenseRows.map(([category, amount]) => (
                <div key={category} className="flex justify-between text-text-muted">
                  <dt>− {t(`expenses.category.${category}`, { context: vocab })}</dt>
                  <dd>{formatCurrency(amount)}</dd>
                </div>
              ))}
              {profit.expenseRows.length === 0 ? <p className="text-text-muted">{t("reportsExtra.noExpenses")}</p> : null}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <dt className="text-text">{t("reportsExtra.netProfit")}</dt>
                <dd className={profit.net >= 0 ? "text-success" : "text-danger"}>{formatCurrency(profit.net)}</dd>
              </div>
            </dl>
          </section>
          <AddExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} onSaved={() => queryClient.invalidateQueries({ queryKey: ["expenses"] })} />
          <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-text">{t("reports.hub.profit.note")} {t("reportsExtra.returnsNote")}</p>
          <Section
            title={t("reports.hub.profit.byProduct")}
            exportLabel={t("reports.hub.download")}
            onExport={() =>
              downloadCsv(exportName("profit"), [
                [outT("reports.hub.col.product"), outT("reports.hub.col.qty"), outT("reports.hub.profit.revenue"), outT("reports.hub.profit.cost"), outT("reports.hub.profit.profit")],
                ...profit.rows.map((r) => [r.name, r.qty, r.revenue.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2)]),
              ])
            }
          >
            {profit.rows.length === 0 ? (
              <EmptyHelp icon={IndianRupee} title={t("reports.hub.empty.title")} body={t("reports.hub.empty.sales")} />
            ) : (
              <TableShell>
                <thead>
                  <tr className="border-b border-border">
                    <Th>{t("reports.hub.col.product")}</Th>
                    <Th align="right">{t("reports.hub.col.qty")}</Th>
                    <Th align="right">{t("reports.hub.profit.revenue")}</Th>
                    <Th align="right">{t("reports.hub.profit.cost")}</Th>
                    <Th align="right">{t("reports.hub.profit.profit")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profit.rows.map((r) => (
                    <tr key={r.name}>
                      <td className="px-4 py-3 font-semibold text-text">{r.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text">{r.qty}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text">{formatCurrency(r.revenue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-muted">{formatCurrency(r.cost)}</td>
                      <td className={clsx("px-4 py-3 text-right font-bold tabular-nums", r.profit >= 0 ? "text-success" : "text-danger")}>{formatCurrency(r.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Section>
        </div>
      ) : report === "stock" ? (
        <div className="space-y-6">
          <SummaryRow>
            <SummaryTile label={t("reports.hub.stock.atCost")} value={formatCurrency(stockReport.atCost)} detail={t("reports.hub.stock.atCostDetail")} icon={Boxes} tone="primary" />
            <SummaryTile label={t("reports.hub.stock.atWholesale")} value={formatCurrency(stockReport.atWholesale)} detail={t("reports.hub.stock.atWholesaleDetail")} icon={IndianRupee} tone="success" />
            <SummaryTile label={t("reports.hub.stock.low")} value={String(stockReport.low)} detail={t("reports.hub.stock.lowDetail")} icon={Truck} tone="warning" />
            <SummaryTile label={t("reports.hub.stock.dead")} value={String(stockReport.dead.length)} detail={t("reports.hub.stock.deadDetail", { period: periodLabel })} icon={Boxes} tone="danger" />
          </SummaryRow>
          <Section
            title={t("reports.hub.stock.list")}
            exportLabel={t("reports.hub.download")}
            onExport={() =>
              downloadCsv(exportName("stock"), [
                [outT("reports.hub.col.product"), outT("reports.hub.col.qty"), outT("reports.hub.stock.atCost"), outT("reports.hub.stock.atWholesale"), outT("reports.hub.stock.soldInPeriod")],
                ...stockReport.rows.map((r) => [r.name, `${r.qty} ${r.unit}`, r.cost.toFixed(2), r.wholesale.toFixed(2), r.sold ? "yes" : "no"]),
              ])
            }
          >
            <TableShell>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t("reports.hub.col.product")}</Th>
                  <Th align="right">{t("reports.hub.col.qty")}</Th>
                  <Th align="right">{t("reports.hub.stock.atCost")}</Th>
                  <Th align="right">{t("reports.hub.stock.atWholesale")}</Th>
                  <Th>{t("reports.hub.stock.movement")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockReport.rows.map((r) => (
                  <tr key={r.name}>
                    <td className="px-4 py-3 font-semibold text-text">{r.name}</td>
                    <td className={clsx("px-4 py-3 text-right tabular-nums", r.qty <= r.reorder ? "font-bold text-danger" : "text-text")}>
                      {r.qty} {r.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text">{formatCurrency(r.cost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text">{formatCurrency(r.wholesale)}</td>
                    <td className="px-4 py-3 text-sm">
                      {r.qty > 0 && !r.sold ? (
                        <span className="font-semibold text-danger">{t("reports.hub.stock.notSelling")}</span>
                      ) : r.sold ? (
                        <span className="text-success">{t("reports.hub.stock.selling")}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Section>
        </div>
      ) : report === "dues" ? (
        <div className="space-y-6">
          <SummaryRow>
            <SummaryTile label={t("reports.hub.dues.toCollect")} value={formatCurrency(dues.toCollect)} detail={t("reports.hub.dues.fromCustomers", { count: dues.receivable.length })} icon={Wallet} tone="success" />
            <SummaryTile label={t("reports.hub.dues.toPay")} value={formatCurrency(dues.toPay)} detail={t("reports.hub.dues.toSuppliers", { count: dues.payable.length })} icon={Truck} tone="danger" />
          </SummaryRow>
          <div className="grid gap-6 xl:grid-cols-2">
            <Section
              title={t("reports.hub.dues.customersOwe")}
              exportLabel={t("reports.hub.download")}
              onExport={() => downloadCsv("sethsathi-customer-dues.csv", [[outT("reports.hub.col.customer"), outT("reports.hub.col.phone"), outT("reports.hub.col.amount")], ...dues.receivable.map((c) => [c.name, c.phone ?? "", c.outstanding.toFixed(2)])])}
            >
              <RankTable
                head={[t("reports.hub.col.customer"), t("reports.hub.col.phone"), t("reports.hub.col.amount")]}
                rows={dues.receivable.map((c) => ({ name: c.name, detail: c.phone ?? "—", amount: c.outstanding }))}
                emptyText={t("reports.hub.dues.noneToCollect")}
              />
            </Section>
            <Section
              title={t("reports.hub.dues.youOwe")}
              exportLabel={t("reports.hub.download")}
              onExport={() => downloadCsv("sethsathi-supplier-dues.csv", [[outT("reports.hub.col.supplier"), outT("reports.hub.col.phone"), outT("reports.hub.col.amount")], ...dues.payable.map((s) => [s.name, s.phone ?? "", (s.outstanding ?? 0).toFixed(2)])])}
            >
              <RankTable
                head={[t("reports.hub.col.supplier"), t("reports.hub.col.phone"), t("reports.hub.col.amount")]}
                rows={dues.payable.map((s) => ({ name: s.name, detail: s.phone ?? "—", amount: s.outstanding ?? 0 }))}
                emptyText={t("reports.hub.dues.noneToPay")}
              />
            </Section>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <SummaryRow>
            <SummaryTile label={t("reports.hub.gst.output")} value={formatCurrency(gst.output)} detail={t("reports.hub.gst.outputDetail")} icon={ReceiptText} tone="primary" />
            <SummaryTile label={t("reports.hub.gst.input")} value={formatCurrency(gst.input)} detail={t("reports.hub.gst.inputDetail")} icon={Truck} tone="success" />
            <SummaryTile
              label={gst.net >= 0 ? t("reports.hub.gst.netPay") : t("reports.hub.gst.netCredit")}
              value={formatCurrency(Math.abs(gst.net))}
              detail={periodLabel}
              icon={Landmark}
              tone={gst.net >= 0 ? "danger" : "info"}
            />
          </SummaryRow>
          <p className="rounded-xl bg-info-container px-4 py-3 text-sm text-text">{t("reports.hub.gst.note")}</p>
          <Section
            title={t("reports.hub.gst.byRate")}
            exportLabel={t("reports.hub.download")}
            pro={proGate.locked}
            onExport={() =>
              proGate.guard(() => downloadCsv(exportName("gst"), [
                ["GST %", outT("reports.hub.gst.salesTaxable"), outT("reports.hub.gst.output"), outT("reports.hub.gst.buyTaxable"), outT("reports.hub.gst.input")],
                ...gst.rows.map((r) => [r.rate, r.salesTaxable.toFixed(2), r.salesTax.toFixed(2), r.buyTaxable.toFixed(2), r.buyTax.toFixed(2)]),
              ]))
            }
          >
            {gst.rows.length === 0 ? (
              <EmptyHelp icon={Landmark} title={t("reports.hub.empty.title")} body={t("reports.hub.empty.gst")} />
            ) : (
              <TableShell>
                <thead>
                  <tr className="border-b border-border">
                    <Th>GST %</Th>
                    <Th align="right">{t("reports.hub.gst.salesTaxable")}</Th>
                    <Th align="right">{t("reports.hub.gst.output")}</Th>
                    <Th align="right">{t("reports.hub.gst.buyTaxable")}</Th>
                    <Th align="right">{t("reports.hub.gst.input")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gst.rows.map((r) => (
                    <tr key={r.rate}>
                      <td className="px-4 py-3 font-bold text-text">{r.rate}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text">{formatCurrency(r.salesTaxable)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-text">{formatCurrency(r.salesTax)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text">{formatCurrency(r.buyTaxable)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-text">{formatCurrency(r.buyTax)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Section>
        </div>
      )}

      {!loading && report !== "dues" ? (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => void printInEnglish()}>
            {t("reports.hub.print")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
