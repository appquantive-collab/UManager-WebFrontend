import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2, FileText, MessageCircle, PackagePlus, Phone, Plus, Truck, Wallet } from "lucide-react";
import clsx from "clsx";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/SearchInput";
import { EmptyHelp, FilterChips, LoadingRows, PageGuide, PageIntro, SummaryRow, SummaryTile } from "../../components/page/kit";
import { AddSupplierModal } from "../../components/suppliers/AddSupplierModal";
import { NewPurchaseModal } from "../../components/purchases/NewPurchaseModal";
import { listSuppliers } from "../../lib/suppliers-api";
import { formatCurrency } from "../../lib/format";
import { indianMobile, whatsappLink } from "../../lib/phone";
import { initialParam } from "../../lib/url-params";

type Filter = "all" | "toPay" | "noPurchases";

export function SuppliersPage() {
  const { t, i18n } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [purchaseFor, setPurchaseFor] = useState<string | null>(null);
  const [search, setSearch] = useState(() => initialParam("q"));
  const [filter, setFilter] = useState<Filter>("all");

  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const suppliers = useMemo(() => suppliersQuery.data ?? [], [suppliersQuery.data]);
  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";

  const summary = useMemo(() => {
    const owed = suppliers.filter((s) => (s.outstanding ?? 0) > 0);
    return {
      totalPurchased: suppliers.reduce((sum, s) => sum + (s.totalPurchased ?? 0), 0),
      toPay: owed.reduce((sum, s) => sum + (s.outstanding ?? 0), 0),
      owedCount: owed.length,
    };
  }, [suppliers]);

  const query = search.trim().toLowerCase();
  const visible = suppliers
    .filter((s) => !query || `${s.name} ${s.phone ?? ""} ${s.gstin ?? ""}`.toLowerCase().includes(query))
    .filter(
      (s) =>
        filter === "all" ||
        (filter === "toPay" && (s.outstanding ?? 0) > 0) ||
        (filter === "noPurchases" && (s.purchaseCount ?? 0) === 0)
    )
    // Who you owe the most comes first.
    .sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0) || (b.totalPurchased ?? 0) - (a.totalPurchased ?? 0));

  return (
    <div className="space-y-5">
      <PageIntro text={t("suppliers.hub.intro")}>
        <Button variant="secondary" onClick={() => setPurchaseFor("")}>
          <PackagePlus size={16} className="mr-1.5" aria-hidden="true" />
          {t("purchases.page.newPurchase")}
        </Button>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" aria-hidden="true" />
          {t("suppliers.suppliersPage.addSupplier")}
        </Button>
      </PageIntro>

      <SummaryRow>
        <SummaryTile label={t("suppliers.hub.summary.count")} value={String(suppliers.length)} detail={t("suppliers.hub.summary.countDetail")} icon={Building2} tone="info" />
        <SummaryTile
          label={t("suppliers.hub.summary.toPay")}
          value={formatCurrency(summary.toPay)}
          detail={t("suppliers.hub.summary.toPayDetail", { count: summary.owedCount })}
          icon={Wallet}
          tone="danger"
          onClick={() => setFilter("toPay")}
        />
        <SummaryTile
          label={t("suppliers.hub.summary.bought")}
          value={formatCurrency(summary.totalPurchased)}
          detail={t("suppliers.hub.summary.boughtDetail")}
          icon={Truck}
          tone="primary"
        />
      </SummaryRow>

      <PageGuide
        storageKey="suppliers"
        title={t("suppliers.guide.title")}
        subtitle={t("suppliers.guide.subtitle")}
        stepLabel={(number) => t("sales.guide.step", { number })}
        steps={[
          {
            icon: Building2,
            tone: "info",
            title: t("suppliers.guide.add.title"),
            body: t("suppliers.guide.add.body"),
            action: { label: t("suppliers.suppliersPage.addSupplier"), onClick: () => setAddOpen(true) },
          },
          {
            icon: PackagePlus,
            tone: "primary",
            title: t("suppliers.guide.buy.title"),
            body: t("suppliers.guide.buy.body"),
            action: { label: t("purchases.page.newPurchase"), onClick: () => setPurchaseFor("") },
          },
          { icon: Wallet, tone: "warning", title: t("suppliers.guide.pay.title"), body: t("suppliers.guide.pay.body") },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("suppliers.hub.search")} className="w-full sm:w-72" />
        <FilterChips
          label={t("sales.hub.statusLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: t("suppliers.hub.filter.all"), count: suppliers.length },
            { key: "toPay", label: t("suppliers.hub.filter.toPay"), count: summary.owedCount },
            { key: "noPurchases", label: t("suppliers.hub.filter.noPurchases") },
          ]}
        />
      </div>

      {suppliersQuery.isLoading ? (
        <LoadingRows />
      ) : suppliers.length === 0 ? (
        <EmptyHelp
          icon={Building2}
          title={t("suppliers.hub.empty.title")}
          body={t("suppliers.hub.empty.body")}
          action={<Button onClick={() => setAddOpen(true)}>{t("suppliers.suppliersPage.addSupplier")}</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyHelp icon={FileText} title={t("sales.hub.empty.noMatchTitle")} body={t("suppliers.hub.empty.noMatchBody")} />
      ) : (
        <ul className="space-y-3">
          {visible.map((supplier) => {
            const mobile = indianMobile(supplier.phone);
            const owed = supplier.outstanding ?? 0;
            return (
              <li
                key={supplier._id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-elevation-1 lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={supplier.name} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-text">{supplier.name}</p>
                    <p className="text-sm text-text-muted">
                      {[supplier.phone, supplier.gstin ? t("suppliers.suppliersPage.gstinLabel", { gstin: supplier.gstin }) : null].filter(Boolean).join(" · ") ||
                        t("suppliers.hub.noContact")}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-4 text-sm lg:w-[420px]">
                  <div>
                    <dt className="text-xs font-semibold text-text-muted">{t("suppliers.hub.bought")}</dt>
                    <dd className="mt-0.5 font-bold tabular-nums text-text">{formatCurrency(supplier.totalPurchased ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-text-muted">{t("suppliers.hub.toPay")}</dt>
                    <dd className={clsx("mt-0.5 font-bold tabular-nums", owed > 0 ? "text-danger" : "text-text-muted")}>
                      {owed > 0 ? formatCurrency(owed) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-text-muted">{t("suppliers.hub.lastPurchase")}</dt>
                    <dd className="mt-0.5 text-text">
                      {supplier.lastPurchaseAt
                        ? new Date(supplier.lastPurchaseAt).toLocaleDateString(locale, { day: "numeric", month: "short" })
                        : t("suppliers.hub.never")}
                    </dd>
                  </div>
                </dl>

                <div className="flex shrink-0 gap-2">
                  {mobile ? (
                    <>
                      <a
                        href={`tel:+${mobile}`}
                        aria-label={t("dashboard.attention.call", { name: supplier.name })}
                        title={t("dashboard.attention.call", { name: supplier.name })}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Phone size={17} aria-hidden="true" />
                      </a>
                      <a
                        href={whatsappLink(mobile, t("suppliers.hub.whatsappHello", { name: supplier.name }))}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t("suppliers.hub.whatsapp", { name: supplier.name })}
                        title={t("suppliers.hub.whatsapp", { name: supplier.name })}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-success text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success/40"
                      >
                        <MessageCircle size={17} aria-hidden="true" />
                      </a>
                    </>
                  ) : null}
                  <Button variant="secondary" onClick={() => setPurchaseFor(supplier._id)}>
                    <PackagePlus size={16} className="mr-1.5" aria-hidden="true" />
                    {t("suppliers.hub.recordPurchase")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddSupplierModal open={addOpen} onClose={() => setAddOpen(false)} />
      <NewPurchaseModal open={purchaseFor !== null} presetSupplierId={purchaseFor} onClose={() => setPurchaseFor(null)} />
    </div>
  );
}
