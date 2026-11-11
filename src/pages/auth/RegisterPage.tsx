import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PhoneField } from "../../components/ui/PhoneField";
import { SuccessModal } from "../../components/ui/SuccessModal";
import { register as registerTenant } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { useAuthStore } from "../../lib/auth-store";
import { showError } from "../../lib/toast";
import i18n, { currentLanguage } from "../../lib/i18n";

const registerSchema = z.object({
  ownerName: z.string().min(2, { error: () => i18n.t("auth.register.fullNameRequired") }),
  businessName: z.string().min(2, { error: () => i18n.t("auth.register.businessNameRequired") }),
  phone: z.string().regex(/^\d{10}$/, { error: () => i18n.t("auth.register.phoneInvalid") }),
  email: z.string().email({ error: () => i18n.t("auth.register.emailInvalid") }),
  password: z.string().min(8, { error: () => i18n.t("auth.register.passwordTooShort") }),
  agreeToTerms: z.literal(true, { error: () => i18n.t("auth.register.agreeToTermsRequired") }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const session = await registerTenant({
        businessName: values.businessName,
        businessType: "Wholesale",
        ownerName: values.ownerName,
        email: values.email,
        password: values.password,
        phone: values.phone,
        preferredLanguage: currentLanguage(),
      });
      setSession(session);
      setShowSuccess(true);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("auth.register.genericError"));
    }
  };

  return (
    <AuthLayout title={t("auth.register.title")} subtitle={t("auth.register.subtitle")}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label={t("auth.register.fullName")}
          autoComplete="name"
          error={errors.ownerName?.message}
          {...registerField("ownerName")}
        />
        <TextField
          label={t("auth.register.businessName")}
          autoComplete="organization"
          placeholder={t("auth.register.businessNamePlaceholder")}
          error={errors.businessName?.message}
          {...registerField("businessName")}
        />
        <PhoneField
          label={t("auth.register.mobileNumber")}
          placeholder="98230 45812"
          error={errors.phone?.message}
          {...registerField("phone")}
        />
        <TextField
          label={t("auth.register.email")}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...registerField("email")}
        />
        <TextField
          label={t("auth.register.createPassword")}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...registerField("password")}
        />

        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            {...registerField("agreeToTerms")}
          />
          <span>
            {t("auth.register.agreeToTermsPrefix")}{" "}
            <a href="#" className="font-medium text-primary hover:underline">
              {t("auth.register.terms")}
            </a>{" "}
            &amp;{" "}
            <a href="#" className="font-medium text-primary hover:underline">
              {t("auth.register.privacyPolicy")}
            </a>
          </span>
        </label>
        {errors.agreeToTerms ? <p className="-mt-2 text-xs text-danger">{errors.agreeToTerms.message}</p> : null}

        <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full">
          {t("auth.register.createAccount")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        {t("auth.register.alreadyHaveAccount")}{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t("auth.register.logIn")}
        </Link>
      </p>

      <SuccessModal
        open={showSuccess}
        title={t("auth.register.successTitle")}
        message={t("auth.register.successMessage")}
        redirectSeconds={3}
        onComplete={() => navigate("/app", { replace: true })}
      />
    </AuthLayout>
  );
}
