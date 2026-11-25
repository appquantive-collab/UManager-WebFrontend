import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Search, Store } from "lucide-react";
import clsx from "clsx";
import { EmptyHelp, LoadingRows, StatusPill } from "../../components/page/kit";
import { getCostsByBusiness, listAdminBusinesses, type BusinessFilter } from "../../lib/admin-api";
import { BusinessDetailModal, planLabel } from "./BusinessDetailModal";
import { adminDate, inr, lastSeen } from "./admin-format";
import { AdminCard, PageHeader, td, th } from "./admin-ui";
import { usePaged } from "../../components/ui/Paged";

const FILTERS: BusinessFilter[] = ["all", "trial", "paid", "expired", "suspended"];
const PAGE_SIZE = 15;

export function AdminBusinessesPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(query.trim());
  const [filter, setFilter] = useState<BusinessFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // The top bar's search lands here with ?q=…
  useEffect(() => {
    const q = params.get("q");
    if (q !== null) setQuery(q);
  }, [params]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const list = useQuery({ queryKey: ["admin-businesses", debounced, filter], queryFn: () => listAdminBusinesses(debounced, filter) });
  const rows = list.data ?? [];
  // Pages on desktop, load-as-you-scroll on phones.
  const paged = usePaged(rows, { pageSize: PAGE_SIZE, resetKey: `${debounced}|${filter}` });
  const shown = paged.visible;
  const costs = useQuery({ queryKey: ["admin-costs", "by-business"], queryFn: getCostsByBusiness });

  return (
    <div className="space-y-5">
      <PageHeader title={t("admin.businesses.title")} subtitle={t("admin.businesses.subtitle")} />

      <AdminCard bodyClassName="p-0">
        {/* Toolbar: search + plan filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex h-10 w-full max-w-xs items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
            <Search size={16} className="shrink-0 text-icon" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.businesses.search")}
              aria-label={t("admin.businesses.search")}
              className="h-full w-full bg-transparent text-sm text-text outline-none placeholder:text-text-placeholder"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("admin.businesses.filter")}>
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={filter === key}
                onClick={() => setFilter(key)}
                className={clsx(
                  "h-9 rounded-lg border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                  filter === key ? "border-primary/30 bg-primary-container text-primary" : "border-border bg-surface text-text-subtle hover:bg-surface-muted"
                )}
              >
                {t(`admin.filter.${key}`)}
              </button>
            ))}
          </div>
        </div>

        {list.isLoading ? (
          <div className="p-5">
            <LoadingRows rows={6} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyHelp icon={Store} title={t("admin.businesses.emptyTitle")} body={t("admin.businesses.emptyBody")} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[50rem] border-collapse">
                <thead>
                  <tr className="bg-surface-muted">
                    <th className={th}>Business</th>
                    <th className={th}>Contact</th>
                    <th className={th}>Activity</th>
                    <th className={clsx(th, "text-right")}>AI this month</th>
                    <th className={clsx(th, "text-right")}>AI today</th>
                    <th className={th}>Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((b) => {
                    const label = planLabel(t, b);
                    return (
                      <tr
                        key={b.tenantId}
                        tabIndex={0}
                        onClick={() => setOpenId(b.tenantId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenId(b.tenantId);
                          }
                        }}
                        className="cursor-pointer outline-none transition-colors hover:bg-primary-container/40 focus-visible:bg-primary-container/50"
                      >
                        <td className={td}>
                          <span className="block max-w-[14rem] truncate font-semibold text-text">{b.businessName}</span>
                          <span className="block max-w-[14rem] truncate text-xs text-text-muted">
                            {b.ownerName ?? "—"} · {b.users} {b.users === 1 ? "login" : "logins"}
                          </span>
                        </td>
                        <td className={td}>
                          <span className="block tabular-nums">{b.ownerPhone ?? "—"}</span>
                          <span className="block max-w-[12rem] truncate text-xs text-text-muted">{b.ownerEmail ?? ""}</span>
                        </td>
                        <td className={td}>
                          <span className="block text-text-subtle">Joined {adminDate(b.createdAt)}</span>
                          <span className="block text-xs text-text-muted">Seen {lastSeen(b.lastSeenAt)}</span>
                        </td>
                        <td className={clsx(td, "text-right tabular-nums")}>{inr(costs.data?.[b.tenantId] ?? 0)}</td>
                        <td className={clsx(td, "text-right tabular-nums")}>
                          {b.aiTodayPct === null ? (
                            <span className="text-xs font-semibold text-success">Unlimited</span>
                          ) : (
                            <span className={clsx("font-semibold", b.aiTodayPct >= 100 ? "text-danger" : b.aiTodayPct >= 70 ? "text-warning" : "text-text")}>{b.aiTodayPct}%</span>
                          )}
                        </td>
                        <td className={td}>
                          <StatusPill tone={label.tone}>{label.text}</StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {paged.footer ? <div className="border-t border-border px-4">{paged.footer}</div> : null}
          </>
        )}
      </AdminCard>
      <BusinessDetailModal tenantId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
