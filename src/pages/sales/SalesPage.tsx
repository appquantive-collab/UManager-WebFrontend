import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  FileText,
  IndianRupee,
  MessageCircle,
  Plus,
  ReceiptText,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/SearchInput";
import { SalesGuide } from "../../components/sales/SalesGuide";
import { EmptyHelp, FilterChips, StatusPill, SummaryRow, SummaryTile, TableShell, Th, LoadingRows, type Tone } from "../../components/page/kit";
import { formatCurrency } from "../../lib/format";
import { indianMobile, whatsappLink } from "../../lib/phone";
import { getProfile } from "../../lib/auth-api";
import { listOrders, type Order } from "../../lib/orders-api";
import { isCancelled, listInvoices, type Invoice, type PaymentMethod } from "../../lib/invoices-api";
import { MobileSalesOrders } from "./MobileSalesOrders";
import { OrderDetailModal } from "../../components/orders/OrderDetailModal";
import { InvoiceDetailModal } from "../../components/orders/InvoiceDetailModal";
import { useNewOrderModalStore } from "../../lib/new-order-store";
import { useNewSaleModalStore } from "../../lib/new-sale-store";
import { initialParam } from "../../lib/url-params";

type Tab = "orders" | "bills" | "payments";
type DateRange = "all" | "today" | "week" | "month";
type OrderFilter = "all" | "open" | "billed" | "cancelled";
type BillFilter = "all" | "due" | "paid";
type MethodFilter = "all" | PaymentMethod;

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeStart(range: DateRange, now: Date): number {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  if (range === "today") return todayStart.getTime();
  if (range === "week") return todayStart.getTime() - 6 * DAY_MS;
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return 0;
}

function customerOf(entity: { customerId: { name: string; phone?: string } | string }) {
  return typeof entity.customerId === "string" ? { name: "", phone: undefined } : entity.customerId;
}

function customerIdOf(entity: { customerId: { _id: string } | string }): string {
  return typeof entity.customerId === "string" ? entity.customerId : entity.customerId._id;
}

// Cancelled bills owe nothing and count nowhere.
const due = (invoice: Invoice) => (isCancelled(invoice) ? 0 : Math.max(0, invoice.totalAmount - invoice.amountPaid));

// ---------- Page ----------

export function SalesPage() {
  const { t, i18n } = useTranslation();
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const openNewSale = useNewSaleModalStore((state) => state.openModal);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Search can open this page on a tab (?tab=bills|orders|payments) filtered by ?q=.
  const [tab, setTab] = useState<Tab>(() => {
    const wanted = initialParam("tab");
    return wanted === "bills" || wanted === "payments" ? wanted : "orders";
  });
  const [search, setSearch] = useState(() => initialParam("q"));
  const [range, setRange] = useState<DateRange>("all");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [billFilter, setBillFilter] = useState<BillFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [now] = useState(() => new Date());

  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });
  const invoicesQuery = useQuery({ queryKey: ["invoices"], queryFn: listInvoices });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const businessName = profile?.tenant?.businessName ?? "SethSathi";

  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);

  // Headline numbers across everything (not affected by the filters below).
  const summary = useMemo(() => {
    const today = rangeStart("today", now);
    const month = rangeStart("month", now);
    const active = invoices.filter((i) => !isCancelled(i));
    const billedToday = active.filter((i) => new Date(i.createdAt).getTime() >= today);
    const dueBills = invoices.filter((i) => due(i) > 0);
    const openOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed");
    return {
      todayTotal: billedToday.reduce((s, i) => s + i.totalAmount, 0),
      todayCount: billedToday.length,
      monthTotal: active.filter((i) => new Date(i.createdAt).getTime() >= month).reduce((s, i) => s + i.totalAmount, 0),
      dueTotal: dueBills.reduce((s, i) => s + due(i), 0),
      dueCount: dueBills.length,
      openCount: openOrders.length,
      openTotal: openOrders.reduce((s, o) => s + o.totalAmount, 0),
    };
  }, [invoices, orders, now]);

  const payments = useMemo(
    () =>
      invoices
        .flatMap((invoice) =>
          invoice.payments.map((payment, index) => ({ key: `${invoice._id}-${index}`, invoice, ...payment }))
        )
        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
    [invoices]
  );

  const query = search.trim().toLowerCase();
  const since = rangeStart(range, now);
  const matchesCustomer = (entity: { customerId: { name: string; phone?: string } | string }, extra = "") => {
    if (!query) return true;
    const customer = customerOf(entity);
    return `${customer.name} ${customer.phone ?? ""} ${extra}`.toLowerCase().includes(query);
  };

  const visibleOrders = orders.filter(
    (o) =>
      new Date(o.createdAt).getTime() >= since &&
      matchesCustomer(o) &&
      (orderFilter === "all" ||
        (orderFilter === "open" && (o.status === "pending" || o.status === "confirmed")) ||
        (orderFilter === "billed" && o.status === "delivered") ||
        (orderFilter === "cancelled" && o.status === "cancelled"))
  );
  const visibleBills = invoices.filter(
    (i) =>
      new Date(i.createdAt).getTime() >= since &&
      matchesCustomer(i, i.invoiceNumber) &&
      (billFilter === "all" || (billFilter === "due" && due(i) > 0) || (billFilter === "paid" && due(i) === 0 && !isCancelled(i)))
  );
  const visiblePayments = payments.filter(
    (p) =>
      new Date(p.paidAt).getTime() >= since &&
      matchesCustomer(p.invoice, p.invoice.invoiceNumber) &&
      (methodFilter === "all" || p.method === methodFilter)
  );

  const showTab = (next: Tab, apply?: () => void) => {
    setTab(next);
    setSearch("");
    apply?.();
  };

  const orderStatus: Record<Order["status"], { label: string; tone: Tone }> = {
    pending: { label: t("sales.salesPage.statusLabel.pending"), tone: "warning" },
    confirmed: { label: t("sales.salesPage.statusLabel.confirmed"), tone: "info" },
    delivered: { label: t("sales.salesPage.statusLabel.delivered"), tone: "success" },
    cancelled: { label: t("sales.salesPage.statusLabel.cancelled"), tone: "neutral" },
  };
  const billStatus: Record<Invoice["paymentStatus"], { label: string; tone: Tone }> = {
    unpaid: { label: t("sales.salesPage.paymentStatusLabel.unpaid"), tone: "danger" },
    partial: { label: t("sales.salesPage.paymentStatusLabel.partial"), tone: "warning" },
    paid: { label: t("sales.salesPage.paymentStatusLabel.paid"), tone: "success" },
  };
  const methodLabel = (method: PaymentMethod) => t(`sales.hub.method.${method}`);

  const tabs: { key: Tab; label: string; count: number; icon: LucideIcon }[] = [
    { key: "orders", label: t("sales.hub.tabs.orders"), count: orders.length, icon: ClipboardList },
    { key: "bills", label: t("sales.hub.tabs.bills"), count: invoices.length, icon: ReceiptText },
    { key: "payments", label: t("sales.hub.tabs.payments"), count: payments.length, icon: Wallet },
  ];

  const loading = ordersQuery.isLoading || invoicesQuery.isLoading;

  return (
    <>
      <div className="lg:hidden">
        <MobileSalesOrders onNewOrder={openNewOrder} onNewSale={openNewSale} />
      </div>

      <div className="hidden space-y-5 lg:block">
        {/* Actions, explained */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-text-muted">{t("sales.hub.intro")}</p>
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={openNewOrder} title={t("sales.hub.newOrderHint")}>
              <Sparkles size={16} className="mr-1.5" strokeWidth={2} aria-hidden="true" />
              {t("sales.salesPage.newOrder")}
            </Button>
            <Button onClick={openNewSale} title={t("sales.hub.newSaleHint")}>
              <Plus size={16} className="mr-1.5" strokeWidth={2} aria-hidden="true" />
              {t("sales.salesPage.newSale")}
            </Button>
          </div>
        </div>

        {/* Headline numbers — each one opens the matching list */}
        <SummaryRow>
          <SummaryTile
            label={t("sales.hub.summary.today")}
            value={formatCurrency(summary.todayTotal)}
            detail={t("sales.hub.summary.bills", { count: summary.todayCount })}
            icon={IndianRupee}
            tone="primary"
            onClick={() => showTab("bills", () => { setRange("today"); setBillFilter("all"); })}
          />
          <SummaryTile
            label={t("sales.hub.summary.month")}
            value={formatCurrency(summary.monthTotal)}
            detail={t("sales.hub.summary.monthDetail")}
            icon={ReceiptText}
            tone="success"
            onClick={() => showTab("bills", () => { setRange("month"); setBillFilter("all"); })}
          />
          <SummaryTile
            label={t("sales.hub.summary.toCollect")}
            value={formatCurrency(summary.dueTotal)}
            detail={t("sales.hub.summary.unpaidBills", { count: summary.dueCount })}
            icon={Wallet}
            tone="danger"
            onClick={() => showTab("bills", () => { setRange("all"); setBillFilter("due"); })}
          />
          <SummaryTile
            label={t("sales.hub.summary.toBill")}
            value={String(summary.openCount)}
            detail={t("sales.hub.summary.worth", { amount: formatCurrency(summary.openTotal) })}
            icon={ClipboardList}
            tone="info"
            onClick={() => showTab("orders", () => { setRange("all"); setOrderFilter("open"); })}
          />
        </SummaryRow>

        <SalesGuide onNewOrder={openNewOrder} onNewSale={openNewSale} />

        {/* Tabs with counts, plus what each one means */}
        <div>
          <div role="tablist" aria-label={t("sales.hub.tabsLabel")} className="flex gap-1 rounded-2xl bg-surface-variant p-1">
            {tabs.map((item) => {
              const active = item.key === tab;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => showTab(item.key)}
                  className={clsx(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                    active ? "bg-surface text-text shadow-elevation-1" : "text-text-muted hover:text-text"
                  )}
                >
                  <item.icon size={17} aria-hidden="true" />
                  {item.label}
                  <span className="rounded-full bg-surface-variant px-2 text-xs tabular-nums text-text">{item.count}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-text-muted">{t(`sales.hub.tabHelp.${tab}`)}</p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(tab === "orders" ? "sales.hub.searchOrders" : "sales.hub.searchBills")}
            className="w-72"
          />
          <FilterChips
            label={t("sales.hub.dateLabel")}
            value={range}
            onChange={setRange}
            options={(["all", "today", "week", "month"] as const).map((key) => ({ key, label: t(`sales.hub.range.${key}`) }))}
          />
          <div className="ml-auto">
            {tab === "orders" ? (
              <FilterChips
                label={t("sales.hub.statusLabel")}
                value={orderFilter}
                onChange={setOrderFilter}
                options={[
                  { key: "all", label: t("sales.hub.orderFilter.all") },
                  { key: "open", label: t("sales.hub.orderFilter.open"), count: summary.openCount },
                  { key: "billed", label: t("sales.hub.orderFilter.billed") },
                  { key: "cancelled", label: t("sales.hub.orderFilter.cancelled") },
                ]}
              />
            ) : tab === "bills" ? (
              <FilterChips
                label={t("sales.hub.statusLabel")}
                value={billFilter}
                onChange={setBillFilter}
                options={[
                  { key: "all", label: t("sales.hub.billFilter.all") },
                  { key: "due", label: t("sales.hub.billFilter.due"), count: summary.dueCount },
                  { key: "paid", label: t("sales.hub.billFilter.paid") },
                ]}
              />
            ) : (
              <FilterChips
                label={t("sales.hub.methodLabel")}
                value={methodFilter}
                onChange={setMethodFilter}
                options={(["all", "cash", "upi", "bank_transfer", "cheque"] as const).map((key) => ({
                  key,
                  label: key === "all" ? t("sales.hub.allMethods") : methodLabel(key),
                }))}
              />
            )}
          </div>
        </div>

        {loading ? (
          <LoadingRows />
        ) : tab === "orders" ? (
          orders.length === 0 ? (
            <EmptyHelp
              icon={ClipboardList}
              title={t("sales.hub.empty.ordersTitle")}
              body={t("sales.hub.empty.ordersBody")}
              action={<Button onClick={openNewOrder}>{t("sales.salesPage.newOrder")}</Button>}
            />
          ) : visibleOrders.length === 0 ? (
            <EmptyHelp icon={FileText} title={t("sales.hub.empty.noMatchTitle")} body={t("sales.hub.empty.noMatchBody")} />
          ) : (
            <TableShell
              footer={
                <>
                  <span className="text-text-muted">{t("sales.hub.footer.orders", { count: visibleOrders.length })}</span>
                  <span className="font-bold text-text">
                    {t("sales.hub.footer.total")}: {formatCurrency(visibleOrders.reduce((s, o) => s + o.totalAmount, 0))}
                  </span>
                </>
              }
            >
              <thead>
                <tr className="border-b border-border">
                  <Th>{t("sales.salesPage.customer")}</Th>
                  <Th>{t("sales.hub.col.items")}</Th>
                  <Th>{t("sales.salesPage.status")}</Th>
                  <Th>{t("sales.salesPage.date")}</Th>
                  <Th align="right">{t("sales.salesPage.amount")}</Th>
                  <Th align="right">{t("sales.hub.col.next")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleOrders.map((order) => {
                  const customer = customerOf(order);
                  const status = orderStatus[order.status];
                  const open = order.status === "pending" || order.status === "confirmed";
                  return (
                    <tr key={order._id} onClick={() => setSelectedOrder(order)} className="cursor-pointer hover:bg-surface-muted">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text">{customer.name || t("sales.salesPage.unknownCustomer")}</p>
                        {customer.phone ? <p className="text-xs text-text-muted">{customer.phone}</p> : null}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="truncate text-text">{order.items.map((item) => item.productName).join(", ")}</p>
                        <p className="text-xs text-text-muted">
                          {t("sales.hub.itemCount", { count: order.items.length })}
                          {order.source === "ai_parsed" ? ` · ${t("sales.hub.byMunshi")}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-text">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-4 py-3 text-right">
                        {open ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openNewSale(customerIdOf(order));
                            }}
                            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            {t("sales.hub.makeBill")}
                          </button>
                        ) : (
                          <span className="text-sm font-semibold text-primary">{t("sales.hub.view")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )
        ) : tab === "bills" ? (
          invoices.length === 0 ? (
            <EmptyHelp
              icon={ReceiptText}
              title={t("sales.hub.empty.billsTitle")}
              body={t("sales.hub.empty.billsBody")}
              action={<Button onClick={openNewSale}>{t("sales.salesPage.newSale")}</Button>}
            />
          ) : visibleBills.length === 0 ? (
            <EmptyHelp icon={FileText} title={t("sales.hub.empty.noMatchTitle")} body={t("sales.hub.empty.noMatchBody")} />
          ) : (
            <TableShell
              footer={
                <>
                  <span className="text-text-muted">{t("sales.hub.footer.bills", { count: visibleBills.length })}</span>
                  <span className="text-text">
                    {t("sales.hub.footer.total")}: <strong>{formatCurrency(visibleBills.reduce((s, i) => s + i.totalAmount, 0))}</strong>
                  </span>
                  <span className="text-danger">
                    {t("sales.hub.footer.due")}: <strong>{formatCurrency(visibleBills.reduce((s, i) => s + due(i), 0))}</strong>
                  </span>
                </>
              }
            >
              <thead>
                <tr className="border-b border-border">
                  <Th>{t("sales.hub.col.bill")}</Th>
                  <Th>{t("sales.salesPage.customer")}</Th>
                  <Th>{t("sales.salesPage.status")}</Th>
                  <Th align="right">{t("sales.salesPage.amount")}</Th>
                  <Th align="right">{t("sales.hub.col.due")}</Th>
                  <Th align="right">{t("sales.hub.col.next")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleBills.map((invoice) => {
                  const customer = customerOf(invoice);
                  const status = isCancelled(invoice) ? { label: t("bill.cancelled"), tone: "neutral" as Tone } : billStatus[invoice.paymentStatus];
                  const balance = due(invoice);
                  const mobile = indianMobile(customer.phone);
                  return (
                    <tr key={invoice._id} onClick={() => setSelectedInvoice(invoice)} className="cursor-pointer hover:bg-surface-muted">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-text-muted">
                          {formatDate(invoice.createdAt)} · {invoice.billType === "gst" ? t("sales.salesPage.gst") : t("sales.salesPage.record")}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text">{customer.name || t("sales.salesPage.unknownCustomer")}</p>
                        {customer.phone ? <p className="text-xs text-text-muted">{customer.phone}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-text">{formatCurrency(invoice.totalAmount)}</td>
                      <td className={clsx("px-4 py-3 text-right font-bold tabular-nums", balance > 0 ? "text-danger" : "text-text-muted")}>
                        {balance > 0 ? formatCurrency(balance) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {balance > 0 && mobile ? (
                            <a
                              href={whatsappLink(
                                mobile,
                                t("sales.hub.reminder", {
                                  name: customer.name,
                                  number: invoice.invoiceNumber,
                                  amount: formatCurrency(balance),
                                  business: businessName,
                                })
                              )}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              aria-label={t("sales.hub.remindOnWhatsapp", { name: customer.name })}
                              title={t("sales.hub.remindOnWhatsapp", { name: customer.name })}
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-success text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success/40"
                            >
                              <MessageCircle size={16} aria-hidden="true" />
                            </a>
                          ) : null}
                          {balance > 0 ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedInvoice(invoice);
                              }}
                              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                              {t("sales.hub.recordPayment")}
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
          <EmptyHelp icon={Wallet} title={t("sales.hub.empty.paymentsTitle")} body={t("sales.hub.empty.paymentsBody")} />
        ) : visiblePayments.length === 0 ? (
          <EmptyHelp icon={FileText} title={t("sales.hub.empty.noMatchTitle")} body={t("sales.hub.empty.noMatchBody")} />
        ) : (
          <TableShell
            footer={
              <>
                <span className="text-text-muted">{t("sales.hub.footer.payments", { count: visiblePayments.length })}</span>
                <span className="font-bold text-success">
                  {t("sales.hub.footer.received")}: {formatCurrency(visiblePayments.reduce((s, p) => s + p.amount, 0))}
                </span>
              </>
            }
          >
            <thead>
              <tr className="border-b border-border">
                <Th>{t("sales.salesPage.date")}</Th>
                <Th>{t("sales.salesPage.customer")}</Th>
                <Th>{t("sales.hub.col.bill")}</Th>
                <Th>{t("sales.hub.col.method")}</Th>
                <Th align="right">{t("sales.hub.col.received")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visiblePayments.map((payment) => (
                <tr key={payment.key} onClick={() => setSelectedInvoice(payment.invoice)} className="cursor-pointer hover:bg-surface-muted">
                  <td className="px-4 py-3 text-text">{formatDate(payment.paidAt)}</td>
                  <td className="px-4 py-3 font-semibold text-text">
                    {customerOf(payment.invoice).name || t("sales.salesPage.unknownCustomer")}
                    {payment.note ? <p className="text-xs font-normal text-text-muted">{payment.note}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-text">{payment.invoice.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone="neutral">{methodLabel(payment.method)}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-success">{formatCurrency(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </>
  );
}
