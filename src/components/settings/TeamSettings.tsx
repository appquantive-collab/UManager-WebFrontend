import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { KeyRound, UserPlus } from "lucide-react";
import clsx from "clsx";
import { Button } from "../ui/Button";
import { Field, ModalShell, StatusPill, inputClass } from "../page/kit";
import { addTeamMember, listTeam, updateTeamMember, type TeamMember, type TeamRole } from "../../lib/team-api";
import { useAuthStore } from "../../lib/auth-store";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

const ROLES: TeamRole[] = ["SALESMAN", "WAREHOUSE_STAFF", "MANAGER"];

/** Login accounts for the shop's people, each with a role that limits what they see. */
export function TeamSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [addOpen, setAddOpen] = useState(false);
  const [resetFor, setResetFor] = useState<TeamMember | null>(null);
  const team = useQuery({ queryKey: ["team"], queryFn: listTeam });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; role?: TeamRole; isActive?: boolean; password?: string }) => updateTeamMember(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      showSuccess(t("team.saved"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-text">{t("team.title")}</h3>
            <p className="mt-0.5 text-sm text-text-muted">{t("team.body")}</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus size={16} aria-hidden="true" /> {t("team.add")}
          </Button>
        </div>

        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {team.isLoading ? <li className="px-4 py-3 text-sm text-text-muted">{t("common.loading")}</li> : null}
          {(team.data ?? []).map((m) => {
            const isOwner = m.role === "OWNER" || m.role === "SUPER_ADMIN";
            const isMe = m._id === me?.userId;
            const locked = isOwner || isMe || (me?.role === "MANAGER" && m.role === "MANAGER");
            return (
              <li key={m._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-text">
                    {m.name}
                    {isMe ? <span className="text-xs font-normal text-text-muted">({t("team.you")})</span> : null}
                    {!m.isActive ? <StatusPill tone="neutral">{t("team.off")}</StatusPill> : null}
                  </p>
                  <p className="truncate text-xs text-text-muted">{[m.phone, m.email].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {locked ? (
                    <span className="text-sm font-semibold text-text">{t(`team.role.${m.role}`)}</span>
                  ) : (
                    <>
                      <select
                        aria-label={t("team.roleFor", { name: m.name })}
                        value={m.role}
                        onChange={(e) => update.mutate({ id: m._id, role: e.target.value as TeamRole })}
                        className="h-10 rounded-lg border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
                      >
                        {ROLES.filter((r) => r !== "MANAGER" || me?.role !== "MANAGER").map((r) => (
                          <option key={r} value={r}>
                            {t(`team.role.${r}`)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setResetFor(m)}
                        aria-label={t("team.resetPassword", { name: m.name })}
                        title={t("team.resetPassword", { name: m.name })}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <KeyRound size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => update.mutate({ id: m._id, isActive: !m.isActive })}
                        className={clsx(
                          "min-h-10 rounded-lg border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          m.isActive ? "border-border text-danger hover:bg-surface-muted" : "border-text bg-text text-surface"
                        )}
                      >
                        {m.isActive ? t("team.turnOff") : t("team.turnOn")}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h3 className="text-base font-bold text-text">{t("team.whoTitle")}</h3>
        <dl className="mt-3 space-y-3 text-sm">
          {(["MANAGER", "SALESMAN", "WAREHOUSE_STAFF"] as const).map((r) => (
            <div key={r}>
              <dt className="font-semibold text-text">{t(`team.role.${r}`)}</dt>
              <dd className="text-text-muted">{t(`team.can.${r}`)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} canAddManager={me?.role !== "MANAGER"} />
      <ResetPasswordModal member={resetFor} onClose={() => setResetFor(null)} onSave={(password) => resetFor && update.mutate({ id: resetFor._id, password })} />
    </div>
  );
}

function AddMemberModal({ open, onClose, canAddManager }: { open: boolean; onClose: () => void; canAddManager: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState<TeamRole>("SALESMAN");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const reset = () => {
    setName("");
    setRole("SALESMAN");
    setPhone("");
    setEmail("");
    setPassword("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      addTeamMember({
        name: name.trim(),
        role,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        password: password || undefined,
      }),
    onSuccess: (m) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      showSuccess(t("team.added", { name: m.name }), m.phone ? t("team.addedPhoneHint", { phone: m.phone }) : t("team.addedEmailHint"));
      reset();
      onClose();
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const phoneOk = /^\d{10}$/.test(phone.trim());
  const emailOk = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6;
  const valid = name.trim() !== "" && (phoneOk || emailOk) && (phone.trim() === "" || phoneOk);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t("team.add")}
      subtitle={t("team.addSub")}
      closeLabel={t("common.close")}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" disabled={!valid} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("team.create")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("common.name")} htmlFor="tm-name">
          <input id="tm-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div>
          <p className="text-sm font-semibold text-text">{t("team.roleLabel")}</p>
          <div className="mt-2 grid gap-2">
            {ROLES.filter((r) => r !== "MANAGER" || canAddManager).map((r) => (
              <label key={r} className={clsx("flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5", role === r ? "border-text" : "border-border")}>
                <input type="radio" name="tm-role" checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-primary" />
                <span>
                  <span className="block text-sm font-semibold text-text">{t(`team.role.${r}`)}</span>
                  <span className="block text-xs text-text-muted">{t(`team.can.${r}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <Field label={t("team.phone")} hint={t("team.phoneHint")} htmlFor="tm-phone">
          <input id="tm-phone" type="tel" inputMode="numeric" maxLength={10} className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-text-muted">{t("team.or")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("team.email")} htmlFor="tm-email">
            <input id="tm-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t("team.password")} hint={t("team.passwordHint")} htmlFor="tm-pass">
            <input id="tm-pass" type="text" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
      </div>
    </ModalShell>
  );
}

function ResetPasswordModal({ member, onClose, onSave }: { member: TeamMember | null; onClose: () => void; onSave: (password: string) => void }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  return (
    <ModalShell
      open={Boolean(member)}
      onClose={onClose}
      title={t("team.resetPassword", { name: member?.name ?? "" })}
      closeLabel={t("common.close")}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            className="flex-1"
            disabled={password.length < 6}
            onClick={() => {
              onSave(password);
              setPassword("");
              onClose();
            }}
          >
            {t("common.saveChanges")}
          </Button>
        </div>
      }
    >
      <Field label={t("team.newPassword")} hint={t("team.passwordHint")} htmlFor="tm-reset">
        <input id="tm-reset" type="text" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </Field>
    </ModalShell>
  );
}
