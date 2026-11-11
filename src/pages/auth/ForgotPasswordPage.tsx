import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import i18n from "../../lib/i18n";

const schema = z.object({
  identifier: z.string().min(3, { error: () => i18n.t("auth.forgotPassword.identifierInvalid") }),
});
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange", reValidateMode: "onChange" });

  const onSubmit = async () => {
    // Password reset delivery isn't implemented in the backend yet — this
    // confirms the request was captured without claiming an email/SMS went out.
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSent(true);
  };

  return (
    <AuthLayout title={t("auth.forgotPassword.title")} subtitle={t("auth.forgotPassword.subtitle")}>
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center text-icon">
            <KeyRound size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">{t("auth.forgotPassword.sentTitle")}</p>
            <p className="mt-1 text-sm text-text-muted">{t("auth.forgotPassword.sentMessage")}</p>
          </div>
          <Link to="/login" className="mt-2 text-sm font-medium text-primary hover:underline">
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </div>
      ) : (
        <>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label={t("auth.forgotPassword.identifierLabel")}
              placeholder={t("auth.forgotPassword.identifierPlaceholder")}
              error={errors.identifier?.message}
              {...register("identifier")}
            />

            <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
              {t("auth.forgotPassword.sendResetCode")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            <Link
              to="/login"
              className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {t("auth.forgotPassword.backToLoginArrow")}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
