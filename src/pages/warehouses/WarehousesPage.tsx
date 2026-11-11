import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Boxes, MapPin, PackagePlus, Plus, Star, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyHelp, LoadingRows, PageGuide, PageIntro, SummaryRow, SummaryTile } from "../../components/page/kit";
import { formatCurrency } from "../../lib/format";
import { listWarehousesWithStats } from "../../lib/warehouses-api";
import { AddWarehouseModal } from "../../components/warehouses/AddWarehouseModal";

export function WarehousesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: listWarehousesWithStats });
  const warehouses = warehousesQuery.data ?? [];

  const totalValue = warehouses.reduce((sum, w) => sum + w.stockValue, 0);
  const totalSkus = warehouses.reduce((sum, w) => sum + w.skuCount, 0);

  return (
    <div className="space-y-5">
      <PageIntro text={t("warehouses.hub.intro")}>
        <Button variant="secondary" onClick={() => navigate("/app/inventory")}>
          <Boxes size={16} className="mr-1.5" aria-hidden="true" />
          {t("warehouses.hub.openInventory")}
        </Button>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" aria-hidden="true" />
          {t("warehouses.warehousesPage.addWarehouse")}
        </Button>
      </PageIntro>

      <SummaryRow>
        <SummaryTile label={t("warehouses.hub.summary.count")} value={String(warehouses.length)} detail={t("warehouses.hub.summary.countDetail")} icon={WarehouseIcon} tone="info" />
        <SummaryTile label={t("warehouses.hub.summary.value")} value={formatCurrency(totalValue)} detail={t("warehouses.hub.summary.valueDetail")} icon={Boxes} tone="primary" />
        <SummaryTile
          label={t("warehouses.hub.summary.stocked")}
          value={String(totalSkus)}
          detail={t("warehouses.hub.summary.stockedDetail")}
          icon={PackagePlus}
          tone="success"
          onClick={() => navigate("/app/inventory")}
        />
      </SummaryRow>

      <PageGuide
        storageKey="warehouses"
        title={t("warehouses.guide.title")}
        subtitle={t("warehouses.guide.subtitle")}
        stepLabel={(number) => t("sales.guide.step", { number })}
        steps={[
          {
            icon: WarehouseIcon,
            tone: "info",
            title: t("warehouses.guide.add.title"),
            body: t("warehouses.guide.add.body"),
            action: { label: t("warehouses.warehousesPage.addWarehouse"), onClick: () => setAddOpen(true) },
          },
          { icon: PackagePlus, tone: "primary", title: t("warehouses.guide.fill.title"), body: t("warehouses.guide.fill.body") },
          { icon: ArrowLeftRight, tone: "warning", title: t("warehouses.guide.move.title"), body: t("warehouses.guide.move.body") },
        ]}
      />

      {warehousesQuery.isLoading ? (
        <LoadingRows rows={3} />
      ) : warehouses.length === 0 ? (
        <EmptyHelp
          icon={WarehouseIcon}
          title={t("warehouses.warehousesPage.emptyTitle")}
          body={t("warehouses.hub.emptyBody")}
          action={<Button onClick={() => setAddOpen(true)}>{t("warehouses.warehousesPage.addWarehouse")}</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((warehouse) => {
            const share = totalValue > 0 ? warehouse.stockValue / totalValue : 0;
            return (
              <li key={warehouse._id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-elevation-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-text">{warehouse.name}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
                      <MapPin size={14} aria-hidden="true" />
                      {warehouse.location || t("warehouses.warehousesPage.noLocationSet")}
                    </p>
                  </div>
                  {warehouse.isDefault ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-container px-2.5 py-1 text-xs font-bold text-warning">
                      <Star size={12} className="fill-current" aria-hidden="true" />
                      {t("warehouses.hub.main")}
                    </span>
                  ) : null}
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-semibold text-text-muted">{t("warehouses.warehousesPage.stockValue")}</dt>
                    <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-text">{formatCurrency(warehouse.stockValue)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-text-muted">{t("warehouses.hub.products")}</dt>
                    <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-text">{warehouse.skuCount}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>{t("warehouses.hub.shareOfStock")}</span>
                    <span className="font-semibold tabular-nums">{Math.round(share * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-variant">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
                  </div>
                </div>

                {warehouse.skuCount === 0 ? <p className="mt-4 rounded-xl bg-surface-muted px-3 py-2 text-sm text-text-muted">{t("warehouses.hub.emptyWarehouse")}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <AddWarehouseModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
