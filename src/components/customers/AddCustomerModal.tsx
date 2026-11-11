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
import { createCustomer, updateCustomer, type CreateCustomerInput } from "../../lib/customers-api";
import { showError, showSuccess } from "../../lib/toast";
import { errorMessage } from "../../lib/api-errors";
import { GST_STATES, GSTIN_PATTERN, stateFromGstin } from "../../lib/gst-states";
import i18n from "../../lib/i18n";

const schema = z.object({
  name: z.string().min(1, { error: () => i18n.t("customers.addCustomerModal.nameRequired") }),
  phone: z.string().optional(),
  creditLimit: z.coerce
    .number()
    .min(0, { error: () => i18n.t("customers.addCustomerModal.creditLimitMin") })
    .optional(),
  gstin: z
    .string()
    .optional()
    .refine((v) => !v || GSTIN_PATTERN.test(v.trim().toUpperCase()), { error: () => i18n.t("businessSettings.gstinInvalid") }),
  address: z.string().optional(),
  stateCode: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export interface EditableCustomer {
  _id: string;
  name: string;
  phone?: string;
  creditLimit: number;
  gstin?: string;
  address?: string;
  stateCode?: string;
}

const blank: FormInput = { name: "", phone: "", creditLimit: 0, gstin: "", address: "", stateCode: "" };

/** Add a customer, or edit one when `customer` is given. */
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
  const [showGst, setShowGst] = useState(false);
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
            creditLimit: customer.creditLimit ?? 0,
            gstin: customer.gstin ?? "",
            address: customer.address ?? "",
            stateCode: customer.stateCode ?? "",
          }
        : blank
    );
    setShowGst(Boolean(customer?.gstin || customer?.address || customer?.stateCode));
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
    mutation.mutate({
      name: values.name.trim(),
      phone: values.phone?.trim() || undefined,
      creditLimit: values.creditLimit ?? 0,
      gstin: values.gstin?.trim().toUpperCase() ?? "",
      address: values.address?.trim() ?? "",
      stateCode: values.stateCode ?? "",
    });
  };

  const handleClose = () => {
    reset(blank);
    onClose();
  };

  const gstinField = register("gstin");

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={editing ? t("customers.addCustomerModal.editTitle") : t("customers.addCustomerModal.title")}
    >
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <TextField
          label={t("common.name")}
          placeholder={t("customers.addCustomerModal.namePlaceholder")}
          autoFocus={!editing}
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label={t("customers.addCustomerModal.phoneLabel")}
          placeholder="+91 98765 43210"
          type="tel"
          inputMode="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <TextField
          label={t("customers.addCustomerModal.creditLimitLabel")}
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          error={errors.creditLimit?.message}
          {...register("creditLimit")}
        />
        <p className="-mt-2 text-xs text-text-muted">{t("customers.addCustomerModal.creditLimitHint")}</p>

        <button
          type="button"
          onClick={() => setShowGst((v) => !v)}
          aria-expanded={showGst}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border px-3.5 text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {t("customers.addCustomerModal.gstSection")}
          <ChevronDown size={16} className={`text-icon transition-transform ${showGst ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {showGst ? (
          <div className="space-y-4">
            <TextField
              label="GSTIN"
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
            <TextField label={t("businessSettings.address")} error={errors.address?.message} {...register("address")} />
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
