import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { createSupplier } from "../../lib/suppliers-api";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import i18n from "../../lib/i18n";

const schema = z.object({
  name: z.string().min(1, { error: () => i18n.t("suppliers.addSupplierModal.nameRequired") }),
  phone: z.string().optional(),
  gstin: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function AddSupplierModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { name: "", phone: "", gstin: "" },
  });

  const mutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      reset({ name: "", phone: "", gstin: "" });
      onClose();
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("suppliers.addSupplierModal.addError"));
    },
  });

  const submit = (values: FormValues) => {
    mutation.mutate({
      name: values.name.trim(),
      phone: values.phone?.trim() || undefined,
      gstin: values.gstin?.trim() || undefined,
    });
  };

  const handleClose = () => {
    reset({ name: "", phone: "", gstin: "" });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} title={t("suppliers.addSupplierModal.title")}>
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <TextField
          label={t("common.name")}
          placeholder={t("suppliers.addSupplierModal.namePlaceholder")}
          autoFocus
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label={t("suppliers.addSupplierModal.phoneLabel")}
          placeholder="+91 98765 43210"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <TextField
          label={t("suppliers.addSupplierModal.gstinLabel")}
          placeholder={t("suppliers.addSupplierModal.gstinPlaceholder")}
          error={errors.gstin?.message}
          {...register("gstin")}
        />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" className="flex-1" isLoading={isSubmitting || mutation.isPending}>
            {t("suppliers.addSupplierModal.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
