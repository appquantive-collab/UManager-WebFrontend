import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { createCustomer } from "../../lib/customers-api";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import i18n from "../../lib/i18n";

const schema = z.object({
  name: z.string().min(1, { error: () => i18n.t("customers.addCustomerModal.nameRequired") }),
  phone: z.string().optional(),
  creditLimit: z.coerce
    .number()
    .min(0, { error: () => i18n.t("customers.addCustomerModal.creditLimitMin") })
    .optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { name: "", phone: "", creditLimit: 0 },
  });

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      reset({ name: "", phone: "", creditLimit: 0 });
      onClose();
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("customers.addCustomerModal.addError"));
    },
  });

  const submit = (values: FormValues) => {
    mutation.mutate({
      name: values.name.trim(),
      phone: values.phone?.trim() || undefined,
      creditLimit: values.creditLimit ?? 0,
    });
  };

  const handleClose = () => {
    reset({ name: "", phone: "", creditLimit: 0 });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} title={t("customers.addCustomerModal.title")}>
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <TextField
          label={t("common.name")}
          placeholder={t("customers.addCustomerModal.namePlaceholder")}
          autoFocus
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label={t("customers.addCustomerModal.phoneLabel")}
          placeholder="+91 98765 43210"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <TextField
          label={t("customers.addCustomerModal.creditLimitLabel")}
          type="number"
          min={0}
          placeholder="0"
          error={errors.creditLimit?.message}
          {...register("creditLimit")}
        />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" className="flex-1" isLoading={isSubmitting || mutation.isPending}>
            {t("customers.addCustomerModal.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
