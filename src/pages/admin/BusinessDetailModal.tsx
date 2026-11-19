import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ban, Gift, Infinity as InfinityIcon, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { FilterChips, LoadingRows, ModalShell, StatusPill } from "../../components/page/kit";
import { BusinessActivityLog, BusinessAiCost, BusinessWork } from "./BusinessActivity";
import { getBusinessActivity } from "../../lib/admin-api";
import { GrantModal } from "../../components/settings/PlatformAdminPlans";
import { deleteAdminBusiness, deleteAdminUser, getAdminBusiness, setAdminUserActive, updateAdminBusiness, type AdminBusinessDetail, type AdminUserRow } from "../../lib/admin-api";
import type { AdminTenantRow } from "../../lib/billing-api";
import { errorMessage } from "../../lib/api-errors";
import { formatCurrency } from "../../lib/format";
import { showError, showSuccess } from "../../lib/toast";
import { adminDate, inr, lastSeen, tokens } from "./admin-format";

const UNLIMITED = 1_000_000_000;

export function planLabel(t: (k: string, o?: Record<string, unknown>) => string, b: { suspended: boolean; state: AdminBusinessDetail["state"] }) {
  if (b.suspended) return { tone: "danger" as const, text: t("admin.status.suspended") };
  if (b.state.status === "trial") return { tone: "neutral" as const, text: t("admin.status.trial") };
  if (b.state.status === "expired") return { tone: "danger" as const, text: t("admin.status.expired") };
  return { tone: "success" as const, text: `${t(`plan.name.${b.state.plan ?? "basic"}`)} · ${t("admin.status.active")}` };
}

/** One login's row with a stop / restart switch (used here and on the Users page). */
/** businessName: shown when deleting an owner (their business goes too). */
export function LoginRow({ user, onOpenBusiness, businessName }: { user: AdminUserRow; onOpenBusiness?: () => void; businessName?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const owner = user.role === "OWNER";
  const ownersBusiness = businessName ?? user.businessName ?? null;
  const remove = useMutation({
    mutationFn: () => deleteAdminUser(user.userId, owner && ownersBusiness ? ownersBusiness : user.name, owner),
    onSuccess: (r) => {
      setDeleting(false);
      showSuccess(r.deleted === "business" ? `${ownersBusiness} and all its data deleted` : `${user.name}'s login deleted`);
      for (const key of ["admin-businesses", "admin-users", "admin-overview", "admin-growth"]) void queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (err) => showError(errorMessage(err, t)),
  });
  const toggle = useMutation({
    mutationFn: () => setAdminUserActive(user.userId, !user.isActive),
    onSuccess: (r) => {
      showSuccess(r.isActive ? t("admin.user.restarted", { name: user.name }) : t("admin.user.stopped", { name: user.name }));
      void queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => showError(errorMessage(err, t)),
  });
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
          <span className="truncate">{user.name}</span>
          <span className="text-xs font-medium text-text-muted">{t(`team.role.${user.role}`)}</span>
          {user.platformAdmin ? <StatusPill tone="success">{t("admin.user.founder")}</StatusPill> : null}
          {!user.isActive ? <StatusPill tone="danger">{t("admin.user.stoppedBadge")}</StatusPill> : null}
        </p>
        <p className="truncate text-xs text-text-muted">
          {[user.phone, user.email].filter(Boolean).join(" · ") || "—"}
          {onOpenBusiness && user.businessName ? (
            <>
              {" · "}
              <button type="button" onClick={onOpenBusiness} className="font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                {user.businessName}
              </button>
            </>
          ) : null}
        </p>
        <p className="text-xs text-text-muted">{t("admin.lastSeen", { when: lastSeen(user.lastSeenAt) })}</p>
      </div>
      {!user.platformAdmin ? (
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={clsx(
            "flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
            user.isActive ? "border-border text-text hover:bg-surface-muted" : "border-primary text-primary hover:bg-primary-container"
          )}
        >
          {toggle.isPending ? <Loader2 size={14} className="animate-spin" /> : user.isActive ? <Ban size={14} aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}
          {user.isActive ? t("admin.user.stop") : t("admin.user.restart")}
        </button>
      ) : null}
      {!user.platformAdmin ? (
        <button
          type="button"
          onClick={() => setDeleting(true)}
          aria-label={`Delete ${user.name}`}
          title="Delete permanently"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-danger outline-none hover:border-danger hover:bg-danger/5 focus-visible:ring-2 focus-visible:ring-danger/40"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      ) : null}
      <ConfirmDeleteModal
        open={deleting}
        title={owner && ownersBusiness ? `Delete ${user.name} and their business?` : `Delete ${user.name}'s login?`}
        lines={
          owner && ownersBusiness
            ? [
                `${user.name} owns "${ownersBusiness}". Deleting the owner deletes the whole business.`,
                "All its bills, purchases, items, stock, customers, suppliers, staff, cash book, orders and Munshi chats are deleted.",
                "Every login of this business is deleted.",
                "Plan payments and AI cost records are kept for your reports.",
              ]
            : [`${user.name}'s login is deleted. They can't sign in again.`, "The business and its data stay as they are."]
        }
        confirmName={owner && ownersBusiness ? ownersBusiness : user.name}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setDeleting(false)}
      />
    </li>
  );
}

export function BusinessDetailModal({ tenantId, onClose }: { tenantId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [granting, setGranting] = useState<AdminTenantRow | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [tab, setTab] = useState<"info" | "work" | "ai" | "activity">("info");
  const [deletingBusiness, setDeletingBusiness] = useState(false);
  const detail = useQuery({
    queryKey: ["admin-businesses", "detail", tenantId],
    queryFn: () => getAdminBusiness(tenantId!),
    enabled: Boolean(tenantId),
  });
  const b = detail.data;
  // Same data as the "AI cost" tab (cached): today's allowance for the Munshi AI box.
  const activity = useQuery({ queryKey: ["admin-businesses", "activity", tenantId], queryFn: () => getBusinessActivity(tenantId!), enabled: Boolean(tenantId) });

  const update = useMutation({
    mutationFn: (patch: { suspended?: boolean; aiTokenLimit?: number | null }) => updateAdminBusiness(tenantId!, patch),
    onSuccess: (_r, patch) => {
      setConfirmSuspend(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      if (patch.suspended !== undefined) showSuccess(patch.suspended ? t("admin.business.suspendedDone") : t("admin.business.unsuspendedDone"));
      else showSuccess(t("admin.business.aiSaved"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const removeBusiness = useMutation({
    mutationFn: () => deleteAdminBusiness(tenantId!, detail.data!.businessName),
    onSuccess: (r) => {
      setDeletingBusiness(false);
      showSuccess(`${r.businessName} and all its data deleted`);
      for (const key of ["admin-businesses", "admin-users", "admin-overview", "admin-growth", "admin-costs"]) void queryClient.invalidateQueries({ queryKey: [key] });
      onClose();
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const close = () => {
    setConfirmSuspend(false);
    setTab("info");
    onClose();
  };
  const unlimited = (b?.aiTokenLimitOverride ?? 0) >= UNLIMITED;
  const thisMonth = b?.aiUsage[0];
  const label = b ? planLabel(t, b) : null;

  return (
    <>
      <ModalShell open={Boolean(tenantId) && !granting} onClose={close} title={b?.businessName ?? t("common.loading")} subtitle={b ? t("admin.business.joined", { date: adminDate(b.createdAt) }) : undefined} closeLabel={t("common.close")}>
        {!b ? (
          <LoadingRows rows={5} />
        ) : (
          <div className="space-y-5">
            <FilterChips
              label={t("admin.business.tabs.label")}
              options={(["info", "work", "ai", "activity"] as const).map((key) => ({ key, label: t(`admin.business.tabs.${key}`) }))}
              value={tab}
              onChange={setTab}
            />
            {tab === "work" ? <BusinessWork tenantId={b.tenantId} /> : null}
            {tab === "ai" ? <BusinessAiCost tenantId={b.tenantId} /> : null}
            {tab === "activity" ? <BusinessActivityLog tenantId={b.tenantId} /> : null}
            {tab === "info" ? (
            <>
            {/* Plan */}
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.business.plan")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {label ? <StatusPill tone={label.tone}>{label.text}</StatusPill> : null}
                  {b.state.endsAt ? <span className="text-sm text-text-muted">{t("plan.until", { date: adminDate(b.state.endsAt) })}</span> : null}
                </div>
              </div>
              <Button variant="secondary" onClick={() => setGranting({ tenantId: b.tenantId, businessName: b.businessName, state: b.state } as AdminTenantRow)}>
                <Gift size={16} aria-hidden="true" />
                {t("admin.business.givePlan")}
              </Button>
            </section>

            {/* Munshi AI */}
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.business.ai")}</p>
                <p className="mt-1 text-sm text-text">
                  {unlimited
                    ? t("admin.business.aiUnlimited")
                    : activity.data
                      ? `Today ${activity.data.ai.allowance.todayPct}% of ${inr(activity.data.ai.allowance.dailyInr)}/day · this month ${inr(activity.data.ai.thisMonthInr)} of ${inr(activity.data.ai.allowance.monthlyInr)}`
                      : "…"}
                </p>
                <p className="text-xs text-text-muted">{t("admin.business.aiUsed", { used: tokens(thisMonth?.tokens ?? 0), calls: thisMonth?.calls ?? 0 })}</p>
              </div>
              <Button variant="secondary" isLoading={update.isPending && update.variables?.aiTokenLimit !== undefined} onClick={() => update.mutate({ aiTokenLimit: unlimited ? null : UNLIMITED })}>
                <InfinityIcon size={16} aria-hidden="true" />
                {unlimited ? t("admin.business.aiBackToPlan") : t("admin.business.aiMakeUnlimited")}
              </Button>
            </section>

            {/* What they've done in the app */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.business.usage")}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {([
                  ["bills", b.counts.bills],
                  ["sales", formatCurrency(b.counts.salesTotal)],
                  ["products", b.counts.products],
                  ["customers", b.counts.customers],
                  ["suppliers", b.counts.suppliers],
                  ["purchases", b.counts.purchases],
                ] as const).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-border px-3 py-2.5">
                    <p className="truncate text-xs text-text-muted">{t(`admin.business.counts.${key}`)}</p>
                    <p className="truncate text-base font-bold tabular-nums text-text">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Business details */}
            <section className="rounded-2xl border border-border p-4 text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.business.details")}</p>
              <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                <dt className="text-text-muted">{t("admin.business.phone")}</dt>
                <dd className="text-text">{b.phone ?? "—"}</dd>
                <dt className="text-text-muted">GSTIN</dt>
                <dd className="text-text">{b.gstin ?? "—"}</dd>
                <dt className="text-text-muted">{t("admin.business.address")}</dt>
                <dd className="break-words text-text">{b.address ?? "—"}</dd>
                <dt className="text-text-muted">{t("admin.business.work")}</dt>
                <dd className="break-words text-text">{b.setup.description ?? (b.setup.completed ? "—" : t("admin.business.setupPending"))}</dd>
                <dt className="text-text-muted">{t("admin.business.setup")}</dt>
                <dd className="text-text">{b.setup.template ?? "—"}</dd>
                <dt className="text-text-muted">{t("admin.business.trade")}</dt>
                <dd className="text-text">
                  {b.setup.trade
                    ? `${(b.setup.trade.buyUnits ?? [b.setup.trade.buyUnit]).join(" / ")} → ${(b.setup.trade.sellUnits ?? [b.setup.trade.sellUnit]).join(" / ")}`
                    : "—"}
                </dd>
              </dl>
            </section>

            {/* Logins */}
            <section className="rounded-2xl border border-border">
              <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.business.logins", { count: b.users.length })}</p>
              <ul className="divide-y divide-border">
                {b.users.map((u) => (
                  <LoginRow key={u.userId} user={u} businessName={b.businessName} />
                ))}
              </ul>
            </section>

            {/* Payments */}
            {b.payments.length > 0 ? (
              <section className="rounded-2xl border border-border">
                <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.business.payments")}</p>
                <ul className="divide-y divide-border text-sm">
                  {b.payments.map((p, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <span className="text-text">
                        {t(`plan.name.${p.plan}`)} · {p.period ? t(`plan.period.${p.period}`) : t("admin.business.days", { count: p.days ?? 0 })}
                        {p.note ? <span className="text-text-muted"> · {p.note}</span> : null}
                      </span>
                      <span className="tabular-nums text-text-muted">
                        {formatCurrency(p.amount)} · {p.method} · {adminDate(p.paidAt ?? p.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Suspend */}
            <section className="rounded-2xl border border-danger/30 p-4">
              <p className="text-sm font-semibold text-text">{b.suspended ? t("admin.business.isSuspended") : t("admin.business.suspendTitle")}</p>
              <p className="mt-0.5 text-xs text-text-muted">{b.suspended ? t("admin.business.unsuspendBody") : t("admin.business.suspendBody")}</p>
              {b.suspended ? (
                <Button className="mt-3" isLoading={update.isPending} onClick={() => update.mutate({ suspended: false })}>
                  <RotateCcw size={16} aria-hidden="true" />
                  {t("admin.business.unsuspend")}
                </Button>
              ) : confirmSuspend ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setConfirmSuspend(false)}>
                    {t("common.cancel")}
                  </Button>
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ suspended: true })}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl bg-danger px-4 text-sm font-semibold text-white outline-none hover:bg-danger/90 focus-visible:ring-2 focus-visible:ring-danger/40 disabled:opacity-50"
                  >
                    {update.isPending ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} aria-hidden="true" />}
                    {t("admin.business.suspendConfirm", { business: b.businessName })}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSuspend(true)}
                  className="mt-3 flex min-h-11 items-center gap-1.5 rounded-xl border border-danger px-4 text-sm font-semibold text-danger outline-none hover:bg-danger/5 focus-visible:ring-2 focus-visible:ring-danger/40"
                >
                  <Ban size={16} aria-hidden="true" />
                  {t("admin.business.suspend")}
                </button>
              )}
            </section>

            {/* Delete for good */}
            <section className="rounded-2xl border border-danger p-4">
              <p className="text-sm font-semibold text-danger">Delete this business permanently</p>
              <p className="mt-0.5 text-xs text-text-muted">Removes the business, all its data and every login. Plan payments and AI cost records stay for your reports. Can't be undone.</p>
              <button
                type="button"
                onClick={() => setDeletingBusiness(true)}
                className="mt-3 flex min-h-11 items-center gap-1.5 rounded-xl bg-danger px-4 text-sm font-semibold text-white outline-none hover:bg-danger/90 focus-visible:ring-2 focus-visible:ring-danger/40"
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete business
              </button>
            </section>
            <ConfirmDeleteModal
              open={deletingBusiness}
              title={`Delete ${b.businessName}?`}
              lines={[
                `"${b.businessName}" and all its data: ${b.counts.bills} bills, ${b.counts.purchases} purchases, ${b.counts.products} items, ${b.counts.customers} customers, ${b.counts.suppliers} suppliers, stock, cash book, orders and Munshi chats.`,
                `All ${b.users.length} logins of this business.`,
                "Plan payments and AI cost records are kept for your reports.",
              ]}
              confirmName={b.businessName}
              busy={removeBusiness.isPending}
              onConfirm={() => removeBusiness.mutate()}
              onClose={() => setDeletingBusiness(false)}
            />
            </>
            ) : null}
          </div>
        )}
      </ModalShell>
      <GrantModal row={granting} onClose={() => setGranting(null)} />
    </>
  );
}
