import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Field, inputClass } from "../page/kit";
import { getProfile } from "../../lib/auth-api";
import { useAuthStore } from "../../lib/auth-store";
import { updateBusinessProfile, type BusinessProfile } from "../../lib/tenants-api";
import { GST_STATES, GSTIN_PATTERN, stateFromGstin, stateName } from "../../lib/gst-states";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";
import { BillDocument } from "../bills/BillDocument";
import type { Invoice } from "../../lib/invoices-api";

type FormState = Required<{ [K in keyof BusinessProfile]: string }>;
const EMPTY: FormState = {
  businessName: "",
  phone: "",
  gstin: "",
  address: "",
  stateCode: "",
  upiId: "",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  invoiceTerms: "",
};

const UPI_PATTERN = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Shared form state for the Business / GST / Bills tabs: load from profile, save only what changed. */
function useBusinessForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === "OWNER" || role === "MANAGER" || role === "SUPER_ADMIN";
  const { data: profile, isLoading } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const saved = useMemo<FormState>(() => {
    const tenant = profile?.tenant;
    return {
      businessName: tenant?.businessName ?? "",
      phone: tenant?.phone ?? "",
      gstin: tenant?.gstin ?? "",
      address: tenant?.address ?? "",
      stateCode: tenant?.stateCode ?? "",
      upiId: tenant?.upiId ?? "",
      bankName: tenant?.bankName ?? "",
      bankAccount: tenant?.bankAccount ?? "",
      bankIfsc: tenant?.bankIfsc ?? "",
      invoiceTerms: tenant?.invoiceTerms ?? "",
    };
  }, [profile]);
  const [form, setForm] = useState<FormState>(EMPTY);
  useEffect(() => setForm(saved), [saved]);

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const changed = (Object.keys(form) as (keyof FormState)[]).filter((k) => form[k].trim() !== saved[k].trim());

  const mutation = useMutation({
    mutationFn: (keys: (keyof FormState)[]) =>
      updateBusinessProfile(Object.fromEntries(keys.map((k) => [k, form[k].trim()])) as Partial<BusinessProfile>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess(t("businessSettings.saved"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  return { t, form, set, changed, mutation, isLoading, canEdit, saved };
}

function SaveBar({
  keys,
  changed,
  onSave,
  saving,
  invalid,
  canEdit,
}: {
  keys: (keyof FormState)[];
  changed: (keyof FormState)[];
  onSave: (keys: (keyof FormState)[]) => void;
  saving: boolean;
  invalid: boolean;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const mine = changed.filter((k) => keys.includes(k));
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
      {!canEdit ? <p className="text-xs text-text-muted">{t("businessSettings.ownerOnly")}</p> : null}
      <Button disabled={!canEdit || mine.length === 0 || invalid} isLoading={saving} onClick={() => onSave(mine)}>
        {t("common.saveChanges")}
      </Button>
    </div>
  );
}

const card = "max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-6";

export function BusinessDetailsSettings() {
  const { t, form, set, changed, mutation, isLoading, canEdit } = useBusinessForm();
  const keys: (keyof FormState)[] = ["businessName", "phone", "address", "stateCode"];
  return (
    <div className={card}>
      <div>
        <h3 className="text-base font-bold text-text">{t("businessSettings.detailsTitle")}</h3>
        <p className="mt-0.5 text-sm text-text-muted">{t("businessSettings.detailsBody")}</p>
      </div>
      {isLoading ? <p className="text-sm text-text-muted">{t("common.loading")}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("settingsPage.businessName")} htmlFor="bs-name">
          <input id="bs-name" className={inputClass} disabled={!canEdit} value={form.businessName} onChange={(e) => set("businessName")(e.target.value)} />
        </Field>
        <Field label={t("businessSettings.shopPhone")} htmlFor="bs-phone">
          <input id="bs-phone" type="tel" inputMode="tel" className={inputClass} disabled={!canEdit} value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
        </Field>
      </div>
      <Field label={t("businessSettings.address")} hint={t("businessSettings.addressHint")} htmlFor="bs-address">
        <textarea
          id="bs-address"
          rows={3}
          className={`${inputClass} h-auto py-2.5`}
          disabled={!canEdit}
          value={form.address}
          onChange={(e) => set("address")(e.target.value)}
        />
      </Field>
      <Field label={t("businessSettings.state")} hint={t("businessSettings.stateHint")} htmlFor="bs-state">
        <select id="bs-state" className={inputClass} disabled={!canEdit} value={form.stateCode} onChange={(e) => set("stateCode")(e.target.value)}>
          <option value="">{t("businessSettings.pickState")}</option>
          {GST_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </Field>
      <SaveBar
        keys={keys}
        changed={changed}
        onSave={(k) => mutation.mutate(k)}
        saving={mutation.isPending}
        invalid={!form.businessName.trim()}
        canEdit={canEdit}
      />
    </div>
  );
}

export function GstSettings() {
  const { t, form, set, changed, mutation, canEdit } = useBusinessForm();
  const gstin = form.gstin.trim().toUpperCase();
  const gstinInvalid = gstin !== "" && !GSTIN_PATTERN.test(gstin);
  const gstinState = stateFromGstin(gstin);
  const keys: (keyof FormState)[] = ["gstin", "stateCode"];

  return (
    <div className="space-y-4">
      <div className={card}>
        <div>
          <h3 className="text-base font-bold text-text">{t("businessSettings.gstTitle")}</h3>
          <p className="mt-0.5 text-sm text-text-muted">{t("businessSettings.gstBody")}</p>
        </div>
        <Field label="GSTIN" hint={gstinInvalid ? undefined : t("businessSettings.gstinHint")} htmlFor="bs-gstin">
          <input
            id="bs-gstin"
            className={`${inputClass} uppercase tracking-wide`}
            disabled={!canEdit}
            maxLength={15}
            placeholder="27ABCDE1234F1Z5"
            value={form.gstin}
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              set("gstin")(value);
              const code = stateFromGstin(value);
              if (GSTIN_PATTERN.test(value) && code) set("stateCode")(code);
            }}
            aria-invalid={gstinInvalid}
          />
        </Field>
        {gstinInvalid ? <p className="-mt-2 text-xs font-semibold text-danger">{t("businessSettings.gstinInvalid")}</p> : null}
        {!gstinInvalid && gstinState ? (
          <p className="-mt-2 text-xs text-text-muted">{t("businessSettings.gstinState", { state: stateName(gstinState) ?? gstinState })}</p>
        ) : null}
        <SaveBar keys={keys} changed={changed} onSave={(k) => mutation.mutate(k)} saving={mutation.isPending} invalid={gstinInvalid} canEdit={canEdit} />
      </div>

      <div className={card}>
        <h3 className="text-base font-bold text-text">{t("businessSettings.howGstTitle")}</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-text">
          <li>{t("businessSettings.howGst1")}</li>
          <li>{t("businessSettings.howGst2")}</li>
          <li>{t("businessSettings.howGst3")}</li>
          <li>{t("businessSettings.howGst4")}</li>
        </ul>
      </div>
    </div>
  );
}

export function BillSettings() {
  const { t, form, set, changed, mutation, canEdit } = useBusinessForm();
  const upiInvalid = form.upiId.trim() !== "" && !UPI_PATTERN.test(form.upiId.trim());
  const ifsc = form.bankIfsc.trim().toUpperCase();
  const ifscInvalid = ifsc !== "" && !IFSC_PATTERN.test(ifsc);
  const keys: (keyof FormState)[] = ["upiId", "bankName", "bankAccount", "bankIfsc", "invoiceTerms"];

  const sample: Invoice = useMemo(
    () => ({
      _id: "sample",
      orderIds: [],
      customerId: { _id: "c", name: t("businessSettings.sampleCustomer") },
      invoiceNumber: "INV-0001",
      billType: "record",
      items: [
        { productId: "p1", productName: t("businessSettings.sampleItem1"), quantity: 2, unit: "kg", unitPrice: 120, gstPercent: 0, lineSubtotal: 240, lineTax: 0, lineTotal: 240 },
        { productId: "p2", productName: t("businessSettings.sampleItem2"), quantity: 3, unit: "pcs", unitPrice: 45, gstPercent: 0, lineSubtotal: 135, lineTax: 0, lineTotal: 135 },
      ],
      subtotal: 375,
      taxTotal: 0,
      totalAmount: 375,
      amountPaid: 0,
      paymentStatus: "unpaid",
      payments: [],
      createdAt: new Date().toISOString(),
    }),
    [t]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]">
      <div className={card}>
        <div>
          <h3 className="text-base font-bold text-text">{t("businessSettings.billTitle")}</h3>
          <p className="mt-0.5 text-sm text-text-muted">{t("businessSettings.billBody")}</p>
        </div>
        <Field label={t("businessSettings.upiId")} hint={upiInvalid ? undefined : t("businessSettings.upiHint")} htmlFor="bs-upi">
          <input id="bs-upi" className={inputClass} disabled={!canEdit} placeholder="shopname@okicici" value={form.upiId} onChange={(e) => set("upiId")(e.target.value)} />
        </Field>
        {upiInvalid ? <p className="-mt-2 text-xs font-semibold text-danger">{t("businessSettings.upiInvalid")}</p> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("businessSettings.bankName")} htmlFor="bs-bank">
            <input id="bs-bank" className={inputClass} disabled={!canEdit} value={form.bankName} onChange={(e) => set("bankName")(e.target.value)} />
          </Field>
          <Field label={t("businessSettings.bankAccount")} htmlFor="bs-acc">
            <input id="bs-acc" inputMode="numeric" className={inputClass} disabled={!canEdit} value={form.bankAccount} onChange={(e) => set("bankAccount")(e.target.value)} />
          </Field>
          <Field label="IFSC" htmlFor="bs-ifsc">
            <input id="bs-ifsc" className={`${inputClass} uppercase`} disabled={!canEdit} maxLength={11} value={form.bankIfsc} onChange={(e) => set("bankIfsc")(e.target.value.toUpperCase())} />
          </Field>
        </div>
        {ifscInvalid ? <p className="-mt-2 text-xs font-semibold text-danger">{t("businessSettings.ifscInvalid")}</p> : null}
        <Field label={t("businessSettings.terms")} hint={t("businessSettings.termsHint")} htmlFor="bs-terms">
          <textarea
            id="bs-terms"
            rows={3}
            className={`${inputClass} h-auto py-2.5`}
            disabled={!canEdit}
            placeholder={t("businessSettings.termsPlaceholder")}
            value={form.invoiceTerms}
            onChange={(e) => set("invoiceTerms")(e.target.value)}
          />
        </Field>
        <SaveBar keys={keys} changed={changed} onSave={(k) => mutation.mutate(k)} saving={mutation.isPending} invalid={upiInvalid || ifscInvalid} canEdit={canEdit} />
      </div>

      <div className="min-w-0">
        <p className="mb-2 text-sm font-semibold text-text">{t("businessSettings.preview")}</p>
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <div className="min-w-[34rem]">
            <BillDocument
              invoice={sample}
              format="a4"
              seller={{
                name: form.businessName,
                phone: form.phone,
                gstin: form.gstin,
                address: form.address,
                stateCode: form.stateCode,
                upiId: upiInvalid ? undefined : form.upiId.trim() || undefined,
                bankName: form.bankName,
                bankAccount: form.bankAccount,
                bankIfsc: form.bankIfsc,
                terms: form.invoiceTerms,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
