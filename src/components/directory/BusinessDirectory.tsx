import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, MessageCircle, Plus, Store } from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "../../lib/auth-store";
import { addFromDirectory, searchDirectory, type AddAs, type DirectoryBusiness } from "../../lib/directory-api";
import { CHAT_ROLES, startChat } from "../../lib/chat-api";
import { chatKeys } from "../../lib/chat-cache";
import { showError, showSuccess } from "../../lib/toast";
import { initials } from "../chat/chat-format";

function useDebounced(value: string, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

/**
 * Other VoiceMunshi businesses matching a name or mobile number, each with
 * "save as customer / supplier / both" and (for owners/managers) Chat.
 */
export function BusinessDirectory({ query, compact = false, onNavigate }: { query: string; compact?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canChat = Boolean(role && (CHAT_ROLES as readonly string[]).includes(role));
  const canCustomer = role !== "WAREHOUSE_STAFF";
  const canSupplier = role !== "SALESMAN";
  const q = useDebounced(query.trim());
  const [picking, setPicking] = useState<string | null>(null);

  const results = useQuery({ queryKey: ["directory", q], queryFn: () => searchDirectory(q), enabled: q.length >= 2, staleTime: 30_000 });

  const add = useMutation({
    mutationFn: ({ b, as }: { b: DirectoryBusiness; as: AddAs }) => addFromDirectory(b.tenantId, as),
    onSuccess: (r, { b, as }) => {
      setPicking(null);
      void qc.invalidateQueries({ queryKey: ["directory"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
      void qc.invalidateQueries({ queryKey: chatKeys.contacts });
      showSuccess(t(`directory.added.${as}`, { name: b.businessName }), r.addedCustomer || r.addedSupplier ? undefined : t("directory.alreadySaved"));
    },
    onError: () => showError(t("directory.addFailed")),
  });

  const chat = useMutation({
    mutationFn: async (b: DirectoryBusiness) => {
      if (b.conversationId) return b.conversationId;
      const contactKind = b.saved.customerId ? "customer" : "supplier";
      const contactId = (b.saved.customerId ?? b.saved.supplierId)!;
      return (await startChat({ contactKind, contactId }))._id;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: chatKeys.list });
      onNavigate?.();
      navigate(`/app/chats/${id}`);
    },
    onError: () => showError(t("chat.new.failed")),
  });

  if (q.length < 2) return null;
  const list = results.data ?? [];

  return (
    <section className={clsx(!compact && "overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1")} aria-busy={results.isFetching}>
      <div className={clsx("flex items-center gap-2", compact ? "mb-1" : "border-b border-border px-4 py-2.5")}>
        <Store size={16} className="shrink-0 text-primary" aria-hidden="true" />
        <h2 className={clsx("font-bold text-text", compact ? "text-xs uppercase tracking-wider text-text-muted" : "text-sm")}>{t("directory.title")}</h2>
        {list.length ? <span className="text-xs text-text-muted">{list.length}</span> : null}
      </div>
      {!compact ? <p className="px-4 pt-2 text-xs text-text-muted">{t("directory.help")}</p> : null}

      {results.isLoading ? <p className={clsx("py-4 text-sm text-text-muted", !compact && "px-4")}>{t("directory.searching")}</p> : null}
      {!results.isLoading && list.length === 0 ? <p className={clsx("py-4 text-sm text-text-muted", !compact && "px-4")}>{t("directory.none", { query: q })}</p> : null}

      <ul className={clsx("divide-y divide-border", !compact && "mt-1")}>
        {list.map((b) => {
          const isCustomer = Boolean(b.saved.customerId);
          const isSupplier = Boolean(b.saved.supplierId);
          const canAddMore = b.reachable && ((!isCustomer && canCustomer) || (!isSupplier && canSupplier));
          const details = [b.businessType, b.place, b.phoneMasked].filter(Boolean).join(" · ");
          const options: AddAs[] = (["customer", "supplier", "both"] as const).filter((as) =>
            as === "customer" ? canCustomer && !isCustomer : as === "supplier" ? canSupplier && !isSupplier : canCustomer && canSupplier && !isCustomer && !isSupplier
          );
          return (
            <li key={b.tenantId} className={clsx("py-3", !compact && "px-4")}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-primary" aria-hidden="true">
                  {initials(b.businessName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">{b.businessName}</span>
                  {details ? <span className="block truncate text-xs text-text-muted">{details}</span> : null}
                  {isCustomer || isSupplier ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {isCustomer ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-1.5 py-px text-[0.6875rem] font-semibold text-success">
                          <Check size={11} strokeWidth={3} aria-hidden="true" />
                          {t("chat.kindTag.customer")}
                        </span>
                      ) : null}
                      {isSupplier ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-1.5 py-px text-[0.6875rem] font-semibold text-success">
                          <Check size={11} strokeWidth={3} aria-hidden="true" />
                          {t("chat.kindTag.supplier")}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {canChat && (isCustomer || isSupplier) ? (
                    <button
                      type="button"
                      onClick={() => chat.mutate(b)}
                      disabled={chat.isPending}
                      aria-label={t("directory.chatWith", { name: b.businessName })}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-primary outline-none hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <MessageCircle size={17} aria-hidden="true" />
                    </button>
                  ) : null}
                  {canAddMore ? (
                    <button
                      type="button"
                      onClick={() => setPicking((p) => (p === b.tenantId ? null : b.tenantId))}
                      aria-expanded={picking === b.tenantId}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-gradient px-3 text-xs font-semibold text-white shadow-brand outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Plus size={15} aria-hidden="true" />
                      {t("directory.add")}
                    </button>
                  ) : !b.reachable ? (
                    <span className="text-xs text-text-muted">{t("directory.noPhone")}</span>
                  ) : null}
                </span>
              </div>

              {picking === b.tenantId ? (
                <div className="mt-2.5 rounded-xl bg-surface-muted p-3">
                  <p className="text-xs font-semibold text-text">{t("directory.addAs", { name: b.businessName })}</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t("directory.addAs", { name: b.businessName })}>
                    {options.map((as) => (
                      <button
                        key={as}
                        type="button"
                        disabled={add.isPending}
                        onClick={() => add.mutate({ b, as })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text outline-none hover:border-primary/60 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                      >
                        {as === "supplier" ? <Building2 size={15} aria-hidden="true" /> : null}
                        {t(`directory.as.${as}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
