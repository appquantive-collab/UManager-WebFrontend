import { useState } from "react";
import { FileText, Plus, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Tabs } from "../../components/ui/Tabs";
import { formatCurrency } from "../../lib/format";
import { mockPurchaseOrders } from "../../lib/mock-data";

const statusTone = {
  "Pending Receipt": "warning",
  Received: "success",
} as const;

function PurchaseOrdersTable() {
  const { t } = useTranslation();

  if (mockPurchaseOrders.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title={t("purchases.purchasesPage.noPurchaseOrdersYetTitle")}
        description={t("purchases.purchasesPage.noPurchaseOrdersYetDescription")}
        action={<Button>{t("purchases.purchasesPage.newPurchaseOrder")}</Button>}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-elevation-1">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3">{t("purchases.purchasesPage.po")}</th>
            <th className="px-4 py-3">{t("purchases.purchasesPage.supplier")}</th>
            <th className="px-4 py-3">{t("purchases.purchasesPage.items")}</th>
            <th className="px-4 py-3">{t("purchases.purchasesPage.status")}</th>
            <th className="px-4 py-3 text-right">{t("purchases.purchasesPage.amount")}</th>
            <th className="px-4 py-3 text-right">{t("purchases.purchasesPage.date")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant">
          {mockPurchaseOrders.map((po) => (
            <tr key={po.id} className="hover:bg-surface-muted">
              <td className="px-4 py-3 font-medium text-text">{po.id}</td>
              <td className="px-4 py-3 text-text">{po.supplier}</td>
              <td className="px-4 py-3 text-text-muted">{po.items}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone[po.status as keyof typeof statusTone] ?? "neutral"}>{po.status}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-text">{formatCurrency(po.amount)}</td>
              <td className="px-4 py-3 text-right text-text-muted">{po.date}</td>
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
    <EmptyState icon={FileText} title={t("purchases.purchasesPage.comingSoon", { label })} description={t("purchases.purchasesPage.beingDesigned")} />
  );
}

export function PurchasesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("orders");

  const tabs = [
    { key: "orders", label: t("purchases.purchasesPage.tabs.orders") },
    { key: "purchases", label: t("purchases.purchasesPage.tabs.purchases") },
    { key: "returns", label: t("purchases.purchasesPage.tabs.returns") },
    { key: "payments", label: t("purchases.purchasesPage.tabs.payments") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          {t("purchases.purchasesPage.newPurchaseOrder")}
        </Button>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "orders" && <PurchaseOrdersTable />}
      {tab === "purchases" && <ComingSoon label={t("purchases.purchasesPage.purchasesLabel")} />}
      {tab === "returns" && <ComingSoon label={t("purchases.purchasesPage.purchaseReturnsLabel")} />}
      {tab === "payments" && <ComingSoon label={t("purchases.purchasesPage.supplierPaymentsLabel")} />}
    </div>
  );
}
