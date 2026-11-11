import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Banknote, FileText, History, Package, Settings, Undo2, Users, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "../ui/Button";
import { FilterChips } from "../page/kit";
import { listAudit, type AuditEntry } from "../../lib/team-api";

const GROUPS = ["all", "bill", "purchase", "stock", "product", "return", "expense", "cash", "team", "settings"] as const;
type Group = (typeof GROUPS)[number];

const ICONS: Record<string, LucideIcon> = {
  bill: FileText,
  purchase: Package,
  stock: Package,
  product: Package,
  return: Undo2,
  expense: Wallet,
  cash: Banknote,
  team: Users,
  settings: Settings,
};

/** Who did what and when — newest first. Owners and managers only. */
export function ActivityLog() {
  const { t, i18n } = useTranslation();
  const [group, setGroup] = useState<Group>("all");
  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";

  const query = useInfiniteQuery({
    queryKey: ["audit", group],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listAudit({ before: pageParam, action: group === "all" ? undefined : group }),
    getNextPageParam: (last: AuditEntry[]) => (last.length >= 100 ? last[last.length - 1].createdAt : undefined),
  });
  const entries = query.data?.pages.flat() ?? [];

  const dayOf = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h3 className="text-base font-bold text-text">{t("activity.title")}</h3>
        <p className="mt-0.5 text-sm text-text-muted">{t("activity.body")}</p>
      </div>
      <FilterChips
        label={t("activity.filter")}
        value={group}
        onChange={setGroup}
        options={GROUPS.map((g) => ({ key: g, label: t(`activity.group.${g}`) }))}
      />
      <div className="rounded-2xl border border-border bg-surface">
        {query.isLoading ? <p className="px-4 py-3 text-sm text-text-muted">{t("common.loading")}</p> : null}
        {!query.isLoading && entries.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <History size={22} className="text-icon" aria-hidden="true" />
            <p className="mt-2 text-sm text-text-muted">{t("activity.empty")}</p>
          </div>
        ) : null}
        <ul>
          {entries.map((e, index) => {
            const day = dayOf(e.createdAt);
            const showDay = index === 0 || day !== dayOf(entries[index - 1].createdAt);
            const Icon = ICONS[e.action.split(".")[0]] ?? History;
            return (
              <li key={e._id}>
                {showDay ? <p className="border-b border-border bg-surface-muted px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">{day}</p> : null}
                <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <Icon size={17} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">{e.summary}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {e.userName} · {new Date(e.createdAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })} · {t(`activity.action.${e.action.replaceAll(".", "_")}`, { defaultValue: e.action })}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {query.hasNextPage ? (
        <Button variant="secondary" isLoading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {t("activity.more")}
        </Button>
      ) : null}
    </div>
  );
}
