import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ChevronDown, Plus, Store, User } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { PhoneField } from "../ui/PhoneField";
import { Button } from "../ui/Button";
import { createCustomer, updateCustomer, type CreateCustomerInput, type Customer } from "../../lib/customers-api";
import { showError, showSuccess } from "../../lib/toast";
import { errorMessage } from "../../lib/api-errors";
import { GST_STATES, GSTIN_PATTERN, stateFromGstin } from "../../lib/gst-states";
import i18n from "../../lib/i18n";

type Kind = "person" | "business";

const AADHAAR_RE = /^[2-9]\d{11}$/;
const FORM_ID = "add-customer-form";

const schema = z.object({
  name: z.string().min(1, { error: () => i18n.t("customers.addCustomerModal.nameRequired") }),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), { error: () => i18n.t("customerForm.emailInvalid") }),
  creditLimit: z.coerce
    .number()
    .min(0, { error: () => i18n.t("customers.addCustomerModal.creditLimitMin") })
    .optional(),
  gstin: z
    .string()
    .optional()
    .refine((v) => !v || GSTIN_PATTERN.test(v.trim().toUpperCase()), { error: () => i18n.t("businessSettings.gstinInvalid") }),
  aadhaar: z
    .string()
    .optional()
    .refine((v) => !v || AADHAAR_RE.test(v.replace(/\s+/g, "")), { error: () => i18n.t("customerForm.aadhaarInvalid") }),
  address: z.string().optional(),
  stateCode: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export interface EditableCustomer {
  _id: string;
  name: string;
  kind?: Kind;
  phone?: string;
  email?: string;
  creditLimit: number;
  gstin?: string;
  aadhaarLast4?: string;
  address?: string;
  stateCode?: string;
}

const blank: FormInput = { name: "", phone: "", email: "", creditLimit: "", gstin: "", aadhaar: "", address: "", stateCode: "" };

/** "1234 5678 9012" while typing. */
function groupAadhaar(raw: string) {
  return raw
    .replace(/\D/g, "")
    .slice(0, 12)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** The phone field already shows +91, so show a saved number without it. */
function nationalNumber(phone: string | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return phone ?? "";
}

/**
 * Add a customer, or edit one when `customer` is given. Asks first whether it's
 * a person or a business, then only what's useful for that: Aadhaar for people,
 * GSTIN for businesses (fills the state for GST bills). The other ID is one tap
 * away, and both are optional.
 */
export function AddCustomerModal({
  open,
  onClose,
  customer,
  initialName = "",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  customer?: EditableCustomer | null;
  /** Pre-fills the name (e.g. what was typed in a sale's party search). */
  initialName?: string;
  /** Called with the new customer after adding one (e.g. a sale picks it straight away). */
  onCreated?: (customer: Customer) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const editing = Boolean(customer);
  const [kind, setKind] = useState<Kind>("person");
  const [showMore, setShowMore] = useState(false);
  const [showOtherId, setShowOtherId] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: blank,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      customer
        ? {
            name: customer.name,
            phone: nationalNumber(customer.phone),
            email: customer.email ?? "",
            creditLimit: customer.creditLimit ? customer.creditLimit : "",
            gstin: customer.gstin ?? "",
            aadhaar: "",
            address: customer.address ?? "",
            stateCode: customer.stateCode ?? "",
          }
        : { ...blank, name: initialName.trim() }
    );
    const startKind = customer?.kind ?? (customer?.gstin ? "business" : "person");
    setKind(startKind);
    // Editing someone who already has the "other" ID: show it.
    setShowOtherId(startKind === "person" ? Boolean(customer?.gstin) : Boolean(customer?.aadhaarLast4));
    setShowMore(Boolean(customer?.email || customer?.address || customer?.stateCode));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialName is read once, when the form opens
  }, [open, customer, reset]);

  const mutation = useMutation({
    mutationFn: (input: CreateCustomerInput) => (customer ? updateCustomer(customer._id, input) : createCustomer(input)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-portfolio"] });
      if (editing) showSuccess(t("customers.addCustomerModal.saved"));
      reset(blank);
      onClose();
      if (!editing) onCreated?.(saved);
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const submit = (values: FormValues) => {
    const aadhaar = values.aadhaar?.replace(/\s+/g, "") ?? "";
    mutation.mutate({
      name: values.name.trim(),
      kind,
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() ?? "",
      creditLimit: values.creditLimit ?? 0,
      gstin: values.gstin?.trim().toUpperCase() ?? "",
      // Only sent when typed, so editing never wipes a saved Aadhaar by accident.
      ...(aadhaar ? { aadhaar } : {}),
      address: values.address?.trim() ?? "",
      stateCode: values.stateCode ?? "",
    });
  };

  const handleClose = () => {
    reset(blank);
    onClose();
  };

  const gstinField = register("gstin");
  const aadhaarField = register("aadhaar");
  const isBusiness = kind === "business";

  const gstinInput = (
    <TextField
      label={t("customerForm.gstinLabel")}
      placeholder="07ABCDE1234F1Z5"
      maxLength={15}
      className="uppercase"
      error={errors.gstin?.message}
      {...gstinField}
      onChange={(e) => {
        void gstinField.onChange(e);
        const value = e.target.value.toUpperCase();
        const code = stateFromGstin(value);
        if (GSTIN_PATTERN.test(value) && code) setValue("stateCode", code);
      }}
    />
  );
  const aadhaarInput = (
    <TextField
      label={t("customerForm.aadhaarLabel")}
      placeholder={customer?.aadhaarLast4 ? t("customerForm.aadhaarSaved", { last4: customer.aadhaarLast4 }) : "1234 5678 9012"}
      inputMode="numeric"
      autoComplete="off"
      maxLength={14}
      error={errors.aadhaar?.message}
      {...aadhaarField}
      onChange={(e) => {
        e.target.value = groupAadhaar(e.target.value);
        void aadhaarField.onChange(e);
      }}
    />
  );

  const kinds: { key: Kind; label: string; Icon: typeof User }[] = [
    { key: "person", label: t("customerForm.kind.person"), Icon: User },
    { key: "business", label: t("customerForm.kind.business"), Icon: Store },
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={editing ? t("customers.addCustomerModal.editTitle") : t("customers.addCustomerModal.title")}
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} className="flex-1" isLoading={isSubmitting || mutation.isPending}>
            {editing ? t("common.saveChanges") : t("customers.addCustomerModal.submit")}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        {/* Person or business: two plain choice cards. */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-text">{t("customerForm.kindLabel")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {kinds.map(({ key, label, Icon }) => {
              const active = kind === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setKind(key)}
                  aria-pressed={active}
                  className={clsx(
                    "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                    active
                      ? "border-primary bg-primary-container text-on-primary-container"
                      : "border-border bg-surface text-text-muted hover:border-outline hover:text-text"
                  )}
                >
                  <Icon size={16} className={active ? "text-primary" : "text-icon"} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <TextField
          label={isBusiness ? t("customerForm.businessName") : t("common.name")}
          placeholder={isBusiness ? t("customerForm.businessNamePlaceholder") : t("customers.addCustomerModal.namePlaceholder")}
          autoFocus={!editing}
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneField
            label={t("customers.addCustomerModal.phoneLabel")}
            placeholder="98765 43210"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <div>
            <TextField
              label={t("customers.addCustomerModal.creditLimitLabel")}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={t("customerForm.noLimit")}
              error={errors.creditLimit?.message}
              {...register("creditLimit")}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-text-muted">{t("customers.addCustomerModal.creditLimitHint")}</p>

        {/* ID: the one that fits this kind of customer, the other one tap away. */}
        <div className="space-y-3 rounded-xl bg-surface-muted p-3.5">
          <div>
            <p className="text-sm font-semibold text-text">{t("customerForm.idTitle")}</p>
            <p className="mt-0.5 text-xs text-text-muted">{isBusiness ? t("customerForm.idHintBusiness") : t("customerForm.idHintPerson")}</p>
          </div>
          {isBusiness ? gstinInput : aadhaarInput}
          {showOtherId ? (
            isBusiness ? aadhaarInput : gstinInput
          ) : (
            <button
              type="button"
              onClick={() => setShowOtherId(true)}
              className="inline-flex items-center gap-1 rounded text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Plus size={14} aria-hidden="true" />
              {isBusiness ? t("customerForm.addAadhaar") : t("customerForm.addGstin")}
            </button>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-sm font-semibold text-text outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("customerForm.moreDetails")}
            <ChevronDown size={16} className={clsx("text-icon transition-transform", showMore && "rotate-180")} aria-hidden="true" />
          </button>
          {showMore ? (
            <div className="mt-2 space-y-4">
              <TextField label={t("businessSettings.address")} placeholder={t("customerForm.addressPlaceholder")} error={errors.address?.message} {...register("address")} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="customer-state" className="text-sm font-semibold text-text">
                  {t("businessSettings.state")}
                </label>
                <select
                  id="customer-state"
                  className="w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
                  {...register("stateCode")}
                >
                  <option value="">{t("businessSettings.pickState")}</option>
                  {GST_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-muted">{t("customers.addCustomerModal.stateHint")}</p>
              </div>
              <TextField
                label={t("customerForm.emailLabel")}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                error={errors.email?.message}
                {...register("email")}
              />
            </div>
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}
