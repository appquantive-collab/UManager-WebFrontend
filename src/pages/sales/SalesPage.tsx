import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Tabs } from "../../components/ui/Tabs";
import { formatCurrency } from "../../lib/format";
import { listOrders, type Order } from "../../lib/orders-api";
import { listInvoices, type Invoice } from "../../lib/invoices-api";
import { MobileSalesOrders } from "./MobileSalesOrders";
import { OrderDetailModal } from "../../components/orders/OrderDetailModal";
import { InvoiceDetailModal } from "../../components/orders/InvoiceDetailModal";
import { useNewOrderModalStore } from "../../lib/new-order-store";
import { useNewSaleModalStore } from "../../lib/new-sale-store";

const orderStatusTone = {
  pending: "warning",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
} as const;

const paymentStatusTone = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
} as const;

function OrdersTable({ onSelect }: { onSelect: (order: Order) => void }) {
  const { t } = useTranslation();
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });

  const orderStatusLabel: Record<Order["status"], string> = {
    pending: t("sales.salesPage.statusLabel.pending"),
    confirmed: t("sales.salesPage.statusLabel.confirmed"),
    delivered: t("sales.salesPage.statusLabel.delivered"),
    cancelled: t("sales.salesPage.statusLabel.cancelled"),
  };

  function customerName(entity: { customerId: { name: string } | string }): string {
    return typeof entity.customerId === "string" ? t("sales.salesPage.unknownCustomer") : entity.customerId.name;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  if (ordersQuery.isLoading) {
    return <p className="p-6 text-sm text-text-muted">{t("sales.salesPage.loadingOrders")}</p>;
  }

  const orders = ordersQuery.data ?? [];

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title={t("sales.salesPage.noOrdersYetTitle")}
        description={t("sales.salesPage.noOrdersYetDescription")}
        action={<Button onClick={openNewOrder}>{t("sales.salesPage.newOrder")}</Button>}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-elevation-1">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3">{t("sales.salesPage.customer")}</th>
            <th className="px-4 py-3">{t("sales.salesPage.items")}</th>
            <th className="px-4 py-3">{t("sales.salesPage.source")}</th>
            <th className="px-4 py-3">{t("sales.salesPage.status")}</th>
            <th className="px-4 py-3 text-right">{t("sales.salesPage.amount")}</th>
            <th className="px-4 py-3 text-right">{t("sales.salesPage.date")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant">
          {orders.map((order) => (
            <tr
              key={order._id}
              onClick={() => onSelect(order)}
              className="cursor-pointer hover:bg-surface-muted"
            >
              <td className="px-4 py-3 font-medium text-text">{customerName(order)}</td>
              <td className="px-4 py-3 text-text-muted">{order.items.length}</td>
              <td className="px-4 py-3 text-text-muted">{order.source === "ai_parsed" ? t("sales.salesPage.aiOrder") : t("sales.salesPage.manual")}</td>
              <td className="px-4 py-3">
                <Badge tone={orderStatusTone[order.status]}>{orderStatusLabel[order.status]}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-text">{formatCurrency(order.totalAmount)}</td>
              <td className="px-4 py-3 text-right text-text-muted">{formatDate(order.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesTable({ onSelect }: { onSelect: (invoice: Invoice) => void }) {
  const { t } = useTranslation();
  const openNewSale = useNewSaleModalStore((state) => state.openModal);
  const invoicesQuery = useQuery({ queryKey: ["invoices"], queryFn: listInvoices });

  const paymentStatusLabel: Record<Invoice["paymentStatus"], string> = {
    unpaid: t("sales.salesPage.paymentStatusLabel.unpaid"),
    partial: t("sales.salesPage.paymentStatusLabel.partial"),
    paid: t("sales.salesPage.paymentStatusLabel.paid"),
  };

  function customerName(entity: { customerId: { name: string } | string }): string {
    return typeof entity.customerId === "string" ? t("sales.salesPage.unknownCustomer") : entity.customerId.name;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  if (invoicesQuery.isLoading) {
    return <p className="p-6 text-sm text-text-muted">{t("sales.salesPage.loadingInvoices")}</p>;
  }

  const invoices = invoicesQuery.data ?? [];

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t("sales.salesPage.noInvoicesYetTitle")}
        description={t("sales.salesPage.noInvoicesYetDescription")}
        action={<Button onClick={openNewSale}>{t("sales.salesPage.newSale")}</Button>}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-elevation-1">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3">{t("sales.salesPage.invoice")}</th>
            <th className="px-4 py-3">{t("sales.salesPage.customer")}</th>
            <th className="px-4 py-3">{t("sales.salesPage.type")}</th>
            <th className="px-4 py-3">{t("sales.salesPage.status")}</th>
            <th className="px-4 py-3 text-right">{t("sales.salesPage.amount")}</th>
            <th className="px-4 py-3 text-right">{t("sales.salesPage.date")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant">
          {invoices.map((invoice) => (
            <tr
              key={invoice._id}
              onClick={() => onSelect(invoice)}
              className="cursor-pointer hover:bg-surface-muted"
            >
              <td className="px-4 py-3 font-medium text-text">{invoice.invoiceNumber}</td>
              <td className="px-4 py-3 text-text">{customerName(invoice)}</td>
              <td className="px-4 py-3 text-text-muted">{invoice.billType === "gst" ? t("sales.salesPage.gst") : t("sales.salesPage.record")}</td>
              <td className="px-4 py-3">
                <Badge tone={paymentStatusTone[invoice.paymentStatus]}>{paymentStatusLabel[invoice.paymentStatus]}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-text">{formatCurrency(invoice.totalAmount)}</td>
              <td className="px-4 py-3 text-right text-text-muted">{formatDate(invoice.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState icon={FileText} title={t("sales.salesPage.comingSoon", { label })} description={t("sales.salesPage.beingDesigned")} />
  );
}

export function SalesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("orders");
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const openNewSale = useNewSaleModalStore((state) => state.openModal);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const tabs = [
    { key: "orders", label: t("sales.salesPage.tabs.orders") },
    { key: "invoices", label: t("sales.salesPage.tabs.invoices") },
    { key: "quotations", label: t("sales.salesPage.tabs.quotations") },
    { key: "returns", label: t("sales.salesPage.tabs.returns") },
    { key: "payments", label: t("sales.salesPage.tabs.payments") },
  ];

  return (
    <>
      <div className="lg:hidden">
        <MobileSalesOrders onNewOrder={openNewOrder} onNewSale={openNewSale} />
      </div>

      <div className="hidden space-y-6 lg:block">
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={openNewOrder}>
            <Sparkles size={16} className="mr-1.5" strokeWidth={2} />
            {t("sales.salesPage.newOrder")}
          </Button>
          <Button onClick={openNewSale}>
            <Plus size={16} className="mr-1.5" strokeWidth={2} />
            {t("sales.salesPage.newSale")}
          </Button>
        </div>

        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {tab === "orders" && <OrdersTable onSelect={setSelectedOrder} />}
        {tab === "invoices" && <InvoicesTable onSelect={setSelectedInvoice} />}
        {tab === "quotations" && <ComingSoon label={t("sales.salesPage.quotationsLabel")} />}
        {tab === "returns" && <ComingSoon label={t("sales.salesPage.returnsLabel")} />}
        {tab === "payments" && <ComingSoon label={t("sales.salesPage.paymentsLabel")} />}
      </div>

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </>
  );
}
