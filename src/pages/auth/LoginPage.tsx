import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PhoneField } from "../../components/ui/PhoneField";
import { login, requestLoginOtp, verifyLoginOtp } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { useAuthStore } from "../../lib/auth-store";
import { showError, showSuccess } from "../../lib/toast";
import i18n from "../../lib/i18n";

const phoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, { error: () => i18n.t("auth.login.phoneInvalid") }),
});
type PhoneFormValues = z.infer<typeof phoneSchema>;

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { error: () => i18n.t("auth.otp.codeInvalidFormat") }),
});
type CodeFormValues = z.infer<typeof codeSchema>;

function formatPhone(phone: string): string {
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
}

function otpErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const key = `auth.otp.errors.${err.code}`;
    if (err.code && i18n.exists(key)) return i18n.t(key, { seconds: err.retryAfterSeconds ?? 30 });
    return err.message;
  }
  return i18n.t("auth.login.genericError");
}

const credentialsSchema = z.object({
  email: z.string().email({ error: () => i18n.t("auth.login.emailInvalid") }),
  password: z.string().min(8, { error: () => i18n.t("auth.login.passwordTooShort") }),
});
type CredentialsFormValues = z.infer<typeof credentialsSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const [useEmail, setUseEmail] = useState(false);
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [isResending, setIsResending] = useState(false);
  const verifyingRef = useRef(false);

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    mode: "onChange",
    reValidateMode: "onChange",
  });
  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (!otpPhone) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [otpPhone]);

  const resendSecondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const startCooldown = (seconds: number) => {
    const current = Date.now();
    setNow(current);
    setResendAt(current + seconds * 1000);
  };
  const credentialsForm = useForm<CredentialsFormValues>({
    resolver: zodResolver(credentialsSchema),
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const redirectAfterLogin = () => {
    const redirectTo = (location.state as { from?: string })?.from ?? "/app";
    navigate(redirectTo, { replace: true });
  };

  const onPhoneSubmit = async (values: PhoneFormValues) => {
    try {
      const result = await requestLoginOtp(values.phone);
      codeForm.reset({ code: "" });
      setOtpPhone(values.phone);
      startCooldown(result.resendAfterSeconds);
    } catch (err) {
      // A code already went out moments ago — let them enter it instead of blocking them.
      if (err instanceof ApiError && err.code === "RESEND_COOLDOWN") {
        codeForm.reset({ code: "" });
        setOtpPhone(values.phone);
        startCooldown(err.retryAfterSeconds ?? 30);
        return;
      }
      showError(otpErrorMessage(err));
    }
  };

  const onCodeSubmit = async (values: CodeFormValues) => {
    if (!otpPhone || verifyingRef.current) return;
    verifyingRef.current = true;
    try {
      const session = await verifyLoginOtp(otpPhone, values.code);
      setSession(session);
      redirectAfterLogin();
    } catch (err) {
      showError(otpErrorMessage(err));
      codeForm.reset({ code: "" });
    } finally {
      verifyingRef.current = false;
    }
  };

  const resendCode = async () => {
    if (!otpPhone) return;
    setIsResending(true);
    try {
      const result = await requestLoginOtp(otpPhone);
      codeForm.reset({ code: "" });
      startCooldown(result.resendAfterSeconds);
      showSuccess(t("auth.otp.codeSent"));
    } catch (err) {
      if (err instanceof ApiError && err.code === "RESEND_COOLDOWN") startCooldown(err.retryAfterSeconds ?? 30);
      showError(otpErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  const codeField = codeForm.register("code", {
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
      if (digits !== event.target.value) codeForm.setValue("code", digits, { shouldValidate: true });
      if (digits.length === 6) void codeForm.handleSubmit(onCodeSubmit)();
    },
  });

  const onCredentialsSubmit = async (values: CredentialsFormValues) => {
    try {
      const session = await login(values);
      setSession(session);
      redirectAfterLogin();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("auth.login.genericError"));
    }
  };

  if (!useEmail && otpPhone) {
    return (
      <AuthLayout title={t("auth.otp.codeTitle")} subtitle={t("auth.otp.codeSubtitle", { phone: formatPhone(otpPhone) })}>
        <form className="flex flex-col gap-4" onSubmit={codeForm.handleSubmit(onCodeSubmit)} noValidate>
          <TextField
            label={t("auth.otp.codeLabel")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            placeholder="••••••"
            className="text-center text-2xl font-bold tracking-[0.5em]"
            error={codeForm.formState.errors.code?.message}
            {...codeField}
          />

          <Button type="submit" isLoading={codeForm.formState.isSubmitting} className="w-full">
            {t("auth.otp.verify")}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setOtpPhone(null)}
              className="font-medium text-text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {t("auth.otp.changeNumber")}
            </button>
            {resendSecondsLeft > 0 ? (
              <span className="text-text-muted">{t("auth.otp.resendIn", { seconds: resendSecondsLeft })}</span>
            ) : (
              <button
                type="button"
                onClick={resendCode}
                disabled={isResending}
                className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              >
                {t("auth.otp.resend")}
              </button>
            )}
          </div>
        </form>
      </AuthLayout>
    );
  }

  if (!useEmail) {
    return (
      <AuthLayout title={t("auth.login.phoneTitle")} subtitle={t("auth.login.phoneSubtitle")}>
        <form className="flex flex-col gap-4" onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} noValidate>
          <PhoneField
            label={t("auth.login.mobileNumber")}
            placeholder="98230 45812"
            error={phoneForm.formState.errors.phone?.message}
            {...phoneForm.register("phone")}
          />

          <Button type="submit" isLoading={phoneForm.formState.isSubmitting} className="w-full">
            {t("auth.otp.sendCode")}
          </Button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-text-muted">{t("auth.login.or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled
              title={t("auth.login.comingSoon")}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-text-muted opacity-60"
            >
              <WhatsAppIcon />
              {t("auth.login.whatsapp")}
            </button>
            <button
              type="button"
              disabled
              title={t("auth.login.comingSoon")}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-text-muted opacity-60"
            >
              <GoogleIcon />
              {t("auth.login.google")}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          <button
            type="button"
            onClick={() => setUseEmail(true)}
            className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("auth.login.signInWithEmailInstead")}
          </button>
        </p>

        <p className="mt-3 text-center text-sm text-text-muted">
          {t("auth.login.noBusinessYet")}{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t("auth.login.signUp")}
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.login.emailTitle")} subtitle={t("auth.login.emailSubtitle")}>
      <form className="flex flex-col gap-4" onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)} noValidate>
        <TextField
          label={t("common.email")}
          type="email"
          autoComplete="email"
          error={credentialsForm.formState.errors.email?.message}
          {...credentialsForm.register("email")}
        />
        <TextField
          label={t("common.password")}
          type="password"
          autoComplete="current-password"
          error={credentialsForm.formState.errors.password?.message}
          {...credentialsForm.register("password")}
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("auth.login.forgotPassword")}
          </Link>
        </div>

        <Button type="submit" isLoading={credentialsForm.formState.isSubmitting} className="w-full">
          {t("auth.login.signIn")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        <button
          type="button"
          onClick={() => setUseEmail(false)}
          className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {t("auth.login.signInWithMobileInstead")}
        </button>
      </p>
    </AuthLayout>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.47 14.38c-.29-.15-1.7-.84-1.97-.93-.26-.1-.46-.15-.65.14-.19.3-.75.94-.92 1.13-.17.2-.34.22-.63.08-.3-.15-1.24-.46-2.37-1.47-.87-.78-1.46-1.74-1.63-2.03-.17-.3-.02-.46.13-.6.13-.13.3-.34.44-.5.15-.17.2-.3.3-.5.1-.19.05-.36-.02-.5-.08-.15-.65-1.58-.9-2.16-.24-.58-.48-.5-.65-.5h-.56c-.19 0-.5.07-.76.36-.26.3-1 1-1 2.4 0 1.42 1.03 2.8 1.18 3 .14.2 2.03 3.1 4.93 4.35.69.3 1.22.47 1.64.6.69.22 1.32.19 1.82.11.55-.08 1.7-.7 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.2-.55-.34Z" />
      <path d="M12 2a10 10 0 0 0-8.5 15.24L2 22l4.9-1.46A10 10 0 1 0 12 2Zm0 18.2a8.16 8.16 0 0 1-4.16-1.14l-.3-.18-3.08.92.93-3-.2-.31A8.2 8.2 0 1 1 12 20.2Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.48-1.13 2.74-2.4 3.58v2.98h3.88c2.27-2.09 3.57-5.17 3.57-8.75Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-2.98c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.07A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.31A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.58.38-2.31V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.07Z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.6 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.62l4 3.07C6.22 6.84 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}
