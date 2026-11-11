import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BellRing, Clock, FileText, MessageCircle, Phone, Plus, ReceiptText, ShieldCheck, UserPlus, Users, Wallet } from "lucide-react";
import clsx from "clsx";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/SearchInput";
import { EmptyHelp, FilterChips, LoadingRows, PageGuide, PageIntro, SummaryRow, SummaryTile } from "../../components/page/kit";
import { formatCurrency } from "../../lib/format";
import { indianMobile, whatsappLink } from "../../lib/phone";
import { getProfile } from "../../lib/auth-api";
import { listCustomers, type CustomerListItem } from "../../lib/customers-api";
import { useNewSaleModalStore } from "../../lib/new-sale-store";
import { AddCustomerModal } from "../../components/customers/AddCustomerModal";
import { PartyPortfolioModal } from "../../components/customers/PartyPortfolioModal";
import { initialParam } from "../../lib/url-params";

type Filter = "all" | "due" | "overLimit" | "inactive";
type Sort = "due" | "top" | "recent" | "name";

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 30;

const overLimit = (c: CustomerListItem) => c.creditLimit > 0 && c.outstanding > c.creditLimit;

export function CustomersPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState(() => initialParam("q"));
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("due");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const openNewSale = useNewSaleModalStore((state) => state.openModal);

  const customersQuery = useQuery({ queryKey: ["customers", "all"], queryFn: () => listCustomers() });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  // The shared "Walk-in customer" record holds counter sales; it is not a real party to manage here.
  const customers = useMemo(() => (customersQuery.data ?? []).filter((c) => !c.isWalkIn), [customersQuery.data]);
  const businessName = profile?.tenant?.businessName ?? "SethSathi";

  const isInactive = (c: CustomerListItem) => !c.lastPurchaseAt || now - new Date(c.lastPurchaseAt).getTime() > INACTIVE_DAYS * DAY_MS;
  const daysSince = (iso: string) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));

  const summary = useMemo(
    () => ({
      due: customers.filter((c) => c.outstanding > 0),
      over: customers.filter(overLimit).length,
      inactive: customers.filter((c) => !c.lastPurchaseAt || now - new Date(c.lastPurchaseAt).getTime() > INACTIVE_DAYS * DAY_MS).length,
    }),
    [customers, now]
  );
  const dueTotal = summary.due.reduce((s, c) => s + c.outstanding, 0);

  const query = search.trim().toLowerCase();
  const visible = customers
    .filter((c) => !query || `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(query))
    .filter((c) => filter === "all" || (filter === "due" && c.outstanding > 0) || (filter === "overLimit" && overLimit(c)) || (filter === "inactive" && isInactive(c)))
    .sort((a, b) => {
      if (sort === "due") return b.outstanding - a.outstanding || b.totalPurchases - a.totalPurchases;
      if (sort === "top") return b.totalPurchases - a.totalPurchases;
      if (sort === "recent") return (b.lastPurchaseAt ? new Date(b.lastPurchaseAt).getTime() : 0) - (a.lastPurchaseAt ? new Date(a.lastPurchaseAt).getTime() : 0);
      return a.name.localeCompare(b.name, i18n.resolvedLanguage);
    });

  return (
    <div className="space-y-5">
      <PageIntro text={t("customers.hub.intro")}>
        <Button variant="secondary" onClick={() => openNewSale()}>
          <ReceiptText size={16} className="mr-1.5" aria-hidden="true" />
          {t("sales.salesPage.newSale")}
        </Button>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" aria-hidden="true" />
          {t("customers.customersPage.addCustomer")}
        </Button>
      </PageIntro>

      <SummaryRow>
        <SummaryTile
          label={t("customers.hub.summary.count")}
          value={String(customers.length)}
          detail={t("customers.hub.summary.countDetail")}
          icon={Users}
          tone="info"
          onClick={() => setFilter("all")}
        />
        <SummaryTile
          label={t("customers.hub.summary.toCollect")}
          value={formatCurrency(dueTotal)}
          detail={t("customers.hub.summary.toCollectDetail", { count: summary.due.length })}
          icon={Wallet}
          tone="danger"
          onClick={() => {
            setFilter("due");
            setSort("due");
          }}
        />
        <SummaryTile
          label={t("customers.hub.summary.overLimit")}
          value={String(summary.over)}
          detail={t("customers.hub.summary.overLimitDetail")}
          icon={AlertTriangle}
          tone="warning"
          onClick={() => setFilter("overLimit")}
        />
        <SummaryTile
          label={t("customers.hub.summary.inactive")}
          value={String(summary.inactive)}
          detail={t("customers.hub.summary.inactiveDetail", { days: INACTIVE_DAYS })}
          icon={Clock}
          tone="neutral"
          onClick={() => {
            setFilter("inactive");
            setSort("recent");
          }}
        />
      </SummaryRow>

      <PageGuide
        storageKey="customers"
        title={t("customers.guide.title")}
        subtitle={t("customers.guide.subtitle")}
        stepLabel={(number) => t("sales.guide.step", { number })}
        steps={[
          {
            icon: UserPlus,
            tone: "info",
            title: t("customers.guide.add.title"),
            body: t("customers.guide.add.body"),
            action: { label: t("customers.customersPage.addCustomer"), onClick: () => setAddOpen(true) },
          },
          {
            icon: ReceiptText,
            tone: "primary",
            title: t("customers.guide.sell.title"),
            body: t("customers.guide.sell.body"),
            action: { label: t("sales.salesPage.newSale"), onClick: () => openNewSale() },
          },
          { icon: BellRing, tone: "warning", title: t("customers.guide.collect.title"), body: t("customers.guide.collect.body") },
          { icon: ShieldCheck, tone: "success", title: t("customers.guide.limit.title"), body: t("customers.guide.limit.body") },
        ]}
        terms={[
          { term: t("customers.guide.terms.due"), meaning: t("customers.guide.terms.dueMeaning") },
          { term: t("customers.guide.terms.limit"), meaning: t("customers.guide.terms.limitMeaning") },
          { term: t("customers.guide.terms.ledger"), meaning: t("customers.guide.terms.ledgerMeaning") },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("customers.customersPage.searchPlaceholder")} className="w-full lg:w-72" />
        <FilterChips
          label={t("sales.hub.statusLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: t("customers.hub.filter.all"), count: customers.length },
            { key: "due", label: t("customers.hub.filter.due"), count: summary.due.length },
            { key: "overLimit", label: t("customers.hub.filter.overLimit"), count: summary.over },
            { key: "inactive", label: t("customers.hub.filter.inactive"), count: summary.inactive },
          ]}
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-text lg:ml-auto">
          {t("customers.hub.sortBy")}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 rounded-xl border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {(["due", "top", "recent", "name"] as const).map((key) => (
              <option key={key} value={key}>
                {t(`customers.hub.sort.${key}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {customersQuery.isLoading ? (
        <LoadingRows />
      ) : customers.length === 0 ? (
        <EmptyHelp
          icon={Users}
          title={t("customers.hub.empty.title")}
          body={t("customers.hub.empty.body")}
          action={<Button onClick={() => setAddOpen(true)}>{t("customers.customersPage.addCustomer")}</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyHelp icon={FileText} title={t("sales.hub.empty.noMatchTitle")} body={t("customers.hub.empty.noMatchBody")} />
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {visible.map((customer) => {
            const mobile = indianMobile(customer.phone);
            const usage = customer.creditLimit > 0 ? Math.min(1, customer.outstanding / customer.creditLimit) : 0;
            const reminder = t("dashboard.attention.reminderMessage", {
              name: customer.name,
              amount: formatCurrency(customer.outstanding),
              business: businessName,
            });
            return (
              <li key={customer._id} className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
                <button
                  type="button"
                  onClick={() => setSelectedId(customer._id)}
                  className="flex items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Avatar name={customer.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-text">{customer.name}</span>
                    <span className="block text-sm text-text-muted">{customer.phone || t("customers.hub.noPhone")}</span>
                  </span>
                  {overLimit(customer) ? (
                    <span className="shrink-0 rounded-full bg-danger-container px-2.5 py-1 text-xs font-bold text-danger">{t("customers.hub.overLimitBadge")}</span>
                  ) : null}
                </button>

                <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-text-muted">{t("customers.customersPage.totalPurchases")}</dt>
                    <dd className="mt-0.5 font-bold tabular-nums text-text">{formatCurrency(customer.totalPurchases)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-text-muted">{t("customers.hub.due")}</dt>
                    <dd className={clsx("mt-0.5 font-bold tabular-nums", customer.outstanding > 0 ? "text-danger" : "text-text-muted")}>
                      {customer.outstanding > 0 ? formatCurrency(customer.outstanding) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-text-muted">{t("customers.customersPage.lastPurchase")}</dt>
                    <dd className={clsx("mt-0.5", customer.lastPurchaseAt && !isInactive(customer) ? "text-text" : "text-warning")}>
                      {customer.lastPurchaseAt ? t("customers.hub.daysAgo", { count: daysSince(customer.lastPurchaseAt) }) : t("suppliers.hub.never")}
                    </dd>
                  </div>
                </dl>

                {customer.creditLimit > 0 ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>{t("customers.hub.creditUsed")}</span>
                      <span className="tabular-nums">
                        {formatCurrency(customer.outstanding)} / {formatCurrency(customer.creditLimit)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-variant">
                      <div
                        className={clsx("h-full rounded-full", usage >= 1 ? "bg-danger" : usage >= 0.7 ? "bg-warning" : "bg-success")}
                        style={{ width: `${Math.max(usage * 100, usage > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                  {mobile ? (
                    <a
                      href={`tel:+${mobile}`}
                      aria-label={t("dashboard.attention.call", { name: customer.name })}
                      title={t("dashboard.attention.call", { name: customer.name })}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Phone size={17} aria-hidden="true" />
                    </a>
                  ) : null}
                  {mobile && customer.outstanding > 0 ? (
                    <a
                      href={whatsappLink(mobile, reminder)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-success px-3 text-sm font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success/40"
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                      {t("customers.hub.remind")}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openNewSale(customer._id)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-text outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <ReceiptText size={16} aria-hidden="true" />
                    {t("sales.salesPage.newSale")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(customer._id)}
                    className="ml-auto inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-primary outline-none hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {t("customers.hub.openLedger")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PartyPortfolioModal customerId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
