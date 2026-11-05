import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { createWarehouse } from "../../lib/warehouses-api";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import i18n from "../../lib/i18n";

const schema = z.object({
  name: z.string().min(1, { error: () => i18n.t("warehouses.addWarehouseModal.nameRequired") }),
  location: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function AddWarehouseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    defaultValues: { name: "", location: "" },
  });

  const mutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      reset({ name: "", location: "" });
      onClose();
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("warehouses.addWarehouseModal.addError"));
    },
  });

  const submit = (values: FormValues) => {
    mutation.mutate({ name: values.name.trim(), location: values.location?.trim() || undefined });
  };

  const handleClose = () => {
    reset({ name: "", location: "" });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} title={t("warehouses.addWarehouseModal.title")}>
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <TextField
          label={t("common.name")}
          placeholder={t("warehouses.addWarehouseModal.namePlaceholder")}
          autoFocus
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label={t("warehouses.addWarehouseModal.locationLabel")}
          placeholder={t("warehouses.addWarehouseModal.locationPlaceholder")}
          error={errors.location?.message}
          {...register("location")}
        />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" className="flex-1" isLoading={isSubmitting || mutation.isPending}>
            {t("warehouses.addWarehouseModal.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
