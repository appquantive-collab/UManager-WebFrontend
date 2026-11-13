import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";
import { createCustomer, updateCustomer, type CreateCustomerInput } from "../../lib/customers-api";
import { showError, showSuccess } from "../../lib/toast";
import { errorMessage } from "../../lib/api-errors";
import { GST_STATES, GSTIN_PATTERN, stateFromGstin } from "../../lib/gst-states";
import i18n from "../../lib/i18n";

type Kind = "person" | "business";

const AADHAAR_RE = /^[2-9]\d{11}$/;

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

/**
 * Add a customer, or edit one when `customer` is given. Asks first whether it's
 * a person or a business, then only what's useful for that: GSTIN for
 * businesses (fills the state for GST bills), Aadhaar for people — both optional.
 */
export function AddCustomerModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer?: EditableCustomer | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const editing = Boolean(customer);
  const [kind, setKind] = useState<Kind>("person");
  const [showMore, setShowMore] = useState(false);
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
            phone: customer.phone ?? "",
            email: customer.email ?? "",
            creditLimit: customer.creditLimit ? customer.creditLimit : "",
            gstin: customer.gstin ?? "",
            aadhaar: "",
            address: customer.address ?? "",
            stateCode: customer.stateCode ?? "",
          }
        : blank
    );
    setKind(customer?.kind ?? (customer?.gstin ? "business" : "person"));
    setShowMore(Boolean(customer?.email || customer?.address || customer?.stateCode));
  }, [open, customer, reset]);

  const mutation = useMutation({
    mutationFn: (input: CreateCustomerInput) => (customer ? updateCustomer(customer._id, input) : createCustomer(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-portfolio"] });
      if (editing) showSuccess(t("customers.addCustomerModal.saved"));
      reset(blank);
      onClose();
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
    <div>
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
      <p className="mt-1 text-xs text-text-muted">{t("customerForm.aadhaarHint")}</p>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={editing ? t("customers.addCustomerModal.editTitle") : t("customers.addCustomerModal.title")}
    >
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-text">{t("customerForm.kindLabel")}</p>
          <SegmentedControl
            className="w-full"
            segments={[
              { key: "person", label: t("customerForm.kind.person") },
              { key: "business", label: t("customerForm.kind.business") },
            ]}
            active={kind}
            onChange={(k) => setKind(k as Kind)}
          />
        </div>

        <TextField
          label={isBusiness ? t("customerForm.businessName") : t("common.name")}
          placeholder={isBusiness ? t("customerForm.businessNamePlaceholder") : t("customers.addCustomerModal.namePlaceholder")}
          autoFocus={!editing}
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label={t("customers.addCustomerModal.phoneLabel")}
          placeholder="+91 98765 43210"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />

        <div className="space-y-4 rounded-xl border border-border p-3.5">
          <div>
            <p className="text-sm font-semibold text-text">{t("customerForm.idTitle")}</p>
            <p className="text-xs text-text-muted">{isBusiness ? t("customerForm.idHintBusiness") : t("customerForm.idHintPerson")}</p>
          </div>
          {/* Business: GSTIN first (needed for B2B GST bills). Person: Aadhaar first. Both optional. */}
          {isBusiness ? (
            <>
              {gstinInput}
              {aadhaarInput}
            </>
          ) : (
            <>
              {aadhaarInput}
              {gstinInput}
            </>
          )}
        </div>

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
          <p className="mt-1 text-xs text-text-muted">{t("customers.addCustomerModal.creditLimitHint")}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border px-3.5 text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {t("customerForm.moreDetails")}
          <ChevronDown size={16} className={`text-icon transition-transform ${showMore ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {showMore ? (
          <div className="space-y-4">
            <TextField label={t("businessSettings.address")} placeholder={t("customerForm.addressPlaceholder")} error={errors.address?.message} {...register("address")} />
            <div>
              <label htmlFor="customer-state" className="text-sm font-semibold text-text">
                {t("businessSettings.state")}
              </label>
              <select
                id="customer-state"
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
                {...register("stateCode")}
              >
                <option value="">{t("businessSettings.pickState")}</option>
                {GST_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-text-muted">{t("customers.addCustomerModal.stateHint")}</p>
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

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" className="flex-1" isLoading={isSubmitting || mutation.isPending}>
            {editing ? t("common.saveChanges") : t("customers.addCustomerModal.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
