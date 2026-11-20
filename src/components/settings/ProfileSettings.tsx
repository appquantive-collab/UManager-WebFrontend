import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Field, inputClass } from "../page/kit";
import { getProfile, updateProfile, type ProfilePatch } from "../../lib/auth-api";
import { useAuthStore } from "../../lib/auth-store";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

const card = "max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-card";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The signed-in person's own details: name, mobile, email. */
function MyDetailsCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const { data: profile, isLoading } = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  const saved = useMemo(
    () => ({ name: profile?.name ?? "", phone: profile?.phone ?? "", email: profile?.email ?? "" }),
    [profile]
  );
  const [form, setForm] = useState(saved);
  useEffect(() => setForm(saved), [saved]);

  const name = form.name.trim();
  const phone = form.phone.trim();
  const email = form.email.trim().toLowerCase();
  const nameInvalid = name.length < 2;
  const phoneInvalid = phone !== "" && !/^\d{10}$/.test(phone);
  const emailInvalid = email !== "" && !EMAIL_PATTERN.test(email);
  const noSignIn = !phone && !email;
  const patch: ProfilePatch = {};
  if (name !== saved.name) patch.name = name;
  if (phone !== saved.phone) patch.phone = phone;
  if (email !== saved.email) patch.email = email;
  const dirty = Object.keys(patch).length > 0;

  const mutation = useMutation({
    mutationFn: () => updateProfile(patch),
    onSuccess: (result) => {
      updateUser({ name: result.name, email: result.email });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess(t("profileSettings.saved"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className={card}>
      <div>
        <h3 className="text-base font-bold text-text">{t("profileSettings.title")}</h3>
        <p className="mt-0.5 text-sm text-text-muted">{t("profileSettings.body")}</p>
      </div>
      {isLoading ? <p className="text-sm text-text-muted">{t("common.loading")}</p> : null}

      <Field label={t("profileSettings.name")} htmlFor="me-name">
        <input id="me-name" autoComplete="name" className={inputClass} value={form.name} onChange={set("name")} aria-invalid={nameInvalid} />
      </Field>
      {nameInvalid && form.name !== "" ? <p className="-mt-2 text-xs font-semibold text-danger">{t("profileSettings.nameInvalid")}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("profileSettings.phone")} hint={phoneInvalid ? undefined : t("profileSettings.phoneHint")} htmlFor="me-phone">
          <input
            id="me-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            className={inputClass}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
            aria-invalid={phoneInvalid}
          />
        </Field>
        <Field label={t("profileSettings.email")} hint={emailInvalid ? undefined : t("profileSettings.emailHint")} htmlFor="me-email">
          <input id="me-email" type="email" autoComplete="email" className={inputClass} value={form.email} onChange={set("email")} aria-invalid={emailInvalid} />
        </Field>
      </div>
      {phoneInvalid ? <p className="-mt-2 text-xs font-semibold text-danger">{t("profileSettings.phoneInvalid")}</p> : null}
      {emailInvalid ? <p className="-mt-2 text-xs font-semibold text-danger">{t("profileSettings.emailInvalid")}</p> : null}
      {noSignIn ? <p className="-mt-2 text-xs font-semibold text-danger">{t("profileSettings.needOne")}</p> : null}

      {profile ? (
        <p className="text-sm text-text-muted">
          {t("profileSettings.role")}: <span className="font-semibold text-text">{t(`team.role.${profile.role}`, { defaultValue: profile.role })}</span>
        </p>
      ) : null}

      <div className="flex justify-end border-t border-border pt-4">
        <Button disabled={!dirty || nameInvalid || phoneInvalid || emailInvalid || noSignIn} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
          {t("common.saveChanges")}
        </Button>
      </div>
    </div>
  );
}

/** Change (or, for Google / OTP-only sign-ups, set) the login password. */
function PasswordCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const hasPassword = profile?.hasPassword ?? true;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const tooShort = next !== "" && next.length < 8;
  const mismatch = confirm !== "" && confirm !== next;
  const ready = next.length >= 8 && confirm === next && (!hasPassword || current !== "");

  const mutation = useMutation({
    mutationFn: () => updateProfile({ newPassword: next, ...(hasPassword ? { currentPassword: current } : {}) }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess(t("profileSettings.passwordSaved"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  return (
    <form
      className={card}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) mutation.mutate();
      }}
    >
      <div>
        <h3 className="text-base font-bold text-text">{hasPassword ? t("profileSettings.passwordTitle") : t("profileSettings.setPasswordTitle")}</h3>
        <p className="mt-0.5 text-sm text-text-muted">{hasPassword ? t("profileSettings.passwordBody") : t("profileSettings.setPasswordBody")}</p>
      </div>
      {hasPassword ? (
        <Field label={t("profileSettings.currentPassword")} htmlFor="me-pw-current">
          <input id="me-pw-current" type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("profileSettings.newPassword")} hint={tooShort ? undefined : t("profileSettings.passwordHint")} htmlFor="me-pw-new">
          <input id="me-pw-new" type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={tooShort} />
        </Field>
        <Field label={t("profileSettings.confirmPassword")} htmlFor="me-pw-confirm">
          <input id="me-pw-confirm" type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
        </Field>
      </div>
      {tooShort ? <p className="-mt-2 text-xs font-semibold text-danger">{t("profileSettings.passwordShort")}</p> : null}
      {mismatch ? <p className="-mt-2 text-xs font-semibold text-danger">{t("profileSettings.passwordMismatch")}</p> : null}
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" disabled={!ready} isLoading={mutation.isPending}>
          {hasPassword ? t("profileSettings.changePassword") : t("profileSettings.setPassword")}
        </Button>
      </div>
    </form>
  );
}

export function ProfileSettings() {
  return (
    <div className="space-y-6">
      <MyDetailsCard />
      <PasswordCard />
    </div>
  );
}
