import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Tabs } from "../../components/ui/Tabs";
import { formatCurrency } from "../../lib/format";
import { listOrders, type Order } from "../../lib/orders-api";
import { listInvoices, type Invoice } from "../../lib/invoices-api";
import { MobileSalesOrders } from "./MobileSalesOrders";
import { useNewOrderModalStore } from "../../lib/new-order-store";
import { useNewSaleModalStore } from "../../lib/new-sale-store";

const tabs = [
  { key: "orders", label: "Orders" },
  { key: "invoices", label: "Invoices" },
  { key: "quotations", label: "Quotations" },
  { key: "returns", label: "Returns" },
  { key: "payments", label: "Payments" },
];

const orderStatusTone = {
  pending: "warning",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
} as const;

const orderStatusLabel: Record<Order["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  delivered: "Billed",
  cancelled: "Cancelled",
};

const paymentStatusTone = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
} as const;

const paymentStatusLabel: Record<Invoice["paymentStatus"], string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
};

function customerName(entity: { customerId: { name: string } | string }): string {
  return typeof entity.customerId === "string" ? "Unknown customer" : entity.customerId.name;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function OrdersTable() {
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });

  if (ordersQuery.isLoading) {
    return <p className="p-6 text-sm text-text-muted">Loading orders…</p>;
  }

  const orders = ordersQuery.data ?? [];

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="No sales orders yet"
        description="Create your first sales order to start tracking orders and invoices."
        action={<Button onClick={openNewOrder}>New order</Button>}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-elevation-1">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant">
          {orders.map((order) => (
            <tr key={order._id} className="hover:bg-surface-muted">
              <td className="px-4 py-3 font-medium text-text">{customerName(order)}</td>
              <td className="px-4 py-3 text-text-muted">{order.items.length}</td>
              <td className="px-4 py-3 text-text-muted">{order.source === "ai_parsed" ? "AI Order" : "Manual"}</td>
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

function InvoicesTable() {
  const openNewSale = useNewSaleModalStore((state) => state.openModal);
  const invoicesQuery = useQuery({ queryKey: ["invoices"], queryFn: listInvoices });

  if (invoicesQuery.isLoading) {
    return <p className="p-6 text-sm text-text-muted">Loading invoices…</p>;
  }

  const invoices = invoicesQuery.data ?? [];

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices yet"
        description="Bill a customer to generate your first invoice."
        action={<Button onClick={openNewSale}>New sale</Button>}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-elevation-1">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant">
          {invoices.map((invoice) => (
            <tr key={invoice._id} className="hover:bg-surface-muted">
              <td className="px-4 py-3 font-medium text-text">{invoice.invoiceNumber}</td>
              <td className="px-4 py-3 text-text">{customerName(invoice)}</td>
              <td className="px-4 py-3 text-text-muted">{invoice.billType === "gst" ? "GST" : "Record"}</td>
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
  return (
    <EmptyState icon={FileText} title={`${label} coming soon`} description="This section is being designed." />
  );
}

export function SalesPage() {
  const [tab, setTab] = useState("orders");
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const openNewSale = useNewSaleModalStore((state) => state.openModal);

  return (
    <>
      <div className="lg:hidden">
        <MobileSalesOrders onNewOrder={openNewOrder} onNewSale={openNewSale} />
      </div>

      <div className="hidden space-y-6 lg:block">
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={openNewOrder}>
            <Sparkles size={16} className="mr-1.5" strokeWidth={2} />
            New order
          </Button>
          <Button onClick={openNewSale}>
            <Plus size={16} className="mr-1.5" strokeWidth={2} />
            New sale
          </Button>
        </div>

        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {tab === "orders" && <OrdersTable />}
        {tab === "invoices" && <InvoicesTable />}
        {tab === "quotations" && <ComingSoon label="Quotations" />}
        {tab === "returns" && <ComingSoon label="Returns" />}
        {tab === "payments" && <ComingSoon label="Payments" />}
      </div>
    </>
  );
}
