import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import { Tabs } from "../../components/ui/Tabs";
import { formatCurrency } from "../../lib/format";
import { mockReports } from "../../lib/mock-data";

function SalesReport() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label={t("reports.reportsPage.today")} value={formatCurrency(mockReports.sales.today)} />
      <StatCard label={t("reports.reportsPage.thisWeek")} value={formatCurrency(mockReports.sales.week)} />
      <StatCard label={t("reports.reportsPage.thisMonth")} value={formatCurrency(mockReports.sales.month)} />
    </div>
  );
}

function FinancialReport() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard label={t("reports.reportsPage.inventoryValue")} value={formatCurrency(mockReports.inventoryValue)} />
      <StatCard label={t("reports.reportsPage.grossProfitMonth")} value={formatCurrency(mockReports.grossProfit)} />
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={BarChart3}
      title={t("reports.reportsPage.reportComingSoon", { label })}
      description={t("reports.reportsPage.beingDesigned")}
    />
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("sales");

  const tabs = [
    { key: "sales", label: t("reports.reportsPage.tabs.sales") },
    { key: "purchases", label: t("reports.reportsPage.tabs.purchases") },
    { key: "inventory", label: t("reports.reportsPage.tabs.inventory") },
    { key: "financial", label: t("reports.reportsPage.tabs.financial") },
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "sales" && <SalesReport />}
      {tab === "purchases" && <ComingSoon label={t("reports.reportsPage.purchasesLabel")} />}
      {tab === "inventory" && <ComingSoon label={t("reports.reportsPage.inventoryLabel")} />}
      {tab === "financial" && <FinancialReport />}
    </div>
  );
}
