import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Store } from "lucide-react";
import { SearchInput } from "../../components/ui/SearchInput";
import { EmptyHelp, FilterChips, LoadingRows, StatusPill } from "../../components/page/kit";
import { getCostsByBusiness, listAdminBusinesses, type BusinessFilter } from "../../lib/admin-api";
import { BusinessDetailModal, planLabel } from "./BusinessDetailModal";
import { adminDate, inr, lastSeen } from "./admin-format";

const FILTERS: BusinessFilter[] = ["all", "trial", "paid", "expired", "suspended"];

export function AdminBusinessesPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<BusinessFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const list = useQuery({ queryKey: ["admin-businesses", debounced, filter], queryFn: () => listAdminBusinesses(debounced, filter) });
  const rows = list.data ?? [];
  const costs = useQuery({ queryKey: ["admin-costs", "by-business"], queryFn: getCostsByBusiness });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-text">{t("admin.businesses.title")}</h1>
        <p className="text-sm text-text-muted">{t("admin.businesses.subtitle")}</p>
      </div>
      <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.businesses.search")} aria-label={t("admin.businesses.search")} />
      <FilterChips label={t("admin.businesses.filter")} options={FILTERS.map((key) => ({ key, label: t(`admin.filter.${key}`) }))} value={filter} onChange={setFilter} />

      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyHelp icon={Store} title={t("admin.businesses.emptyTitle")} body={t("admin.businesses.emptyBody")} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1">
          {rows.map((b) => {
            const label = planLabel(t, b);
            return (
              <li key={b.tenantId}>
                <button
                  type="button"
                  onClick={() => setOpenId(b.tenantId)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{b.businessName}</span>
                    <span className="block truncate text-xs text-text-muted">
                      {[b.ownerName, b.ownerPhone, b.ownerEmail].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {t("admin.businesses.rowMeta", {
                        joined: adminDate(b.createdAt),
                        seen: lastSeen(b.lastSeenAt),
                        users: b.users,
                        ai: inr(costs.data?.[b.tenantId] ?? 0),
                      })}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill tone={label.tone}>{label.text}</StatusPill>
                    {b.aiTokenLimitOverride && b.aiTokenLimitOverride >= 1_000_000_000 ? <span className="text-[11px] font-semibold text-text-muted">{t("admin.business.aiUnlimited")}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <BusinessDetailModal tenantId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
