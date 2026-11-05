import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2, Phone, Plus } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { listSuppliers } from "../../lib/suppliers-api";
import { AddSupplierModal } from "../../components/suppliers/AddSupplierModal";

export function SuppliersPage() {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const suppliers = suppliersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          {t("suppliers.suppliersPage.addSupplier")}
        </Button>
      </div>

      {suppliersQuery.isLoading ? (
        <p className="p-6 text-sm text-text-muted">{t("suppliers.suppliersPage.loading")}</p>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("suppliers.suppliersPage.emptyTitle")}
          description={t("suppliers.suppliersPage.emptyDescription")}
          action={<Button onClick={() => setAddOpen(true)}>{t("suppliers.suppliersPage.addSupplier")}</Button>}
        />
      ) : (
        <div className="space-y-3">
          {suppliers.map((supplier) => (
            <div
              key={supplier._id}
              className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-elevation-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <Avatar name={supplier.name} />
                <div>
                  <div className="font-semibold text-text">{supplier.name}</div>
                  {supplier.phone ? (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                      <Phone size={13} />
                      {supplier.phone}
                    </div>
                  ) : null}
                  {supplier.gstin ? <div className="mt-0.5 text-xs text-text-muted">{t("suppliers.suppliersPage.gstinLabel", { gstin: supplier.gstin })}</div> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 sm:gap-8">
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">{t("suppliers.suppliersPage.totalPurchased")}</div>
                  <div className="mt-0.5 text-sm text-text-muted">{t("suppliers.suppliersPage.notTrackedYet")}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">{t("suppliers.suppliersPage.outstanding")}</div>
                  <div className="mt-0.5 text-sm text-text-muted">{t("suppliers.suppliersPage.notTrackedYet")}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddSupplierModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
