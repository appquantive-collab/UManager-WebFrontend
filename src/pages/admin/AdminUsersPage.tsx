import { useEffect, useState } from "react";
import { usePaged } from "../../components/ui/Paged";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { SearchInput } from "../../components/ui/SearchInput";
import { EmptyHelp, LoadingRows } from "../../components/page/kit";
import { listAdminUsers } from "../../lib/admin-api";
import { BusinessDetailModal, LoginRow } from "./BusinessDetailModal";

export function AdminUsersPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const list = useQuery({ queryKey: ["admin-users", debounced], queryFn: () => listAdminUsers(debounced) });
  const rows = list.data ?? [];

  const usersPaged = usePaged(rows, { resetKey: rows.length });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[1.625rem] font-bold tracking-tight text-text">{t("admin.users.title")}</h1>
        <p className="text-sm text-text-muted">{t("admin.users.subtitle")}</p>
      </div>
      <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.users.search")} aria-label={t("admin.users.search")} />
      {list.isLoading ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyHelp icon={Users} title={t("admin.users.emptyTitle")} body={t("admin.users.emptyBody")} />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1">
            {usersPaged.visible.map((u) => (
              <LoginRow key={u.userId} user={u} onOpenBusiness={u.tenantId ? () => setOpenId(u.tenantId!) : undefined} />
            ))}
          </ul>
          {usersPaged.footer}
        </>
      )}
      <BusinessDetailModal tenantId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
