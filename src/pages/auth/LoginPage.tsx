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
import { GoogleSignInButton } from "../../components/auth/GoogleSignInButton";
import { googleSignIn, login, requestLoginOtp, verifyLoginOtp } from "../../lib/auth-api";
import { useGoogleClientId } from "../../lib/social-auth";
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
  // Email, or the 10-digit mobile number for accounts made without email.
  email: z
    .string()
    .trim()
    .refine((v) => /^\d{10}$/.test(v) || z.string().email().safeParse(v).success, { error: () => i18n.t("auth.login.emailOrPhoneInvalid") }),
  password: z.string().min(8, { error: () => i18n.t("auth.login.passwordTooShort") }),
});
type CredentialsFormValues = z.infer<typeof credentialsSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Signed out because the VoiceMunshi team suspended the business or stopped this login: say so once.
  useEffect(() => {
    let reason: string | null = null;
    try {
      reason = sessionStorage.getItem("sethsathi.signedOutReason");
      sessionStorage.removeItem("sethsathi.signedOutReason");
    } catch {
      // private mode
    }
    if (reason === "ACCOUNT_SUSPENDED") showError(t("errors.accountSuspended"));
    if (reason === "ACCOUNT_DISABLED") showError(t("errors.accountDisabled"));
  }, [t]);
  const setSession = useAuthStore((state) => state.setSession);
  const [useEmail, setUseEmail] = useState(false);
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [isResending, setIsResending] = useState(false);
  // Temporary: the OTP shown in a popup while SMS delivery isn't set up on the backend.
  const [shownCode, setShownCode] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  // Errors show once the field is left or the form is sent, not while still typing.
  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    mode: "onTouched",
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
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  // ---- OTP fills itself in ----
  // Android Chrome: reads the code from the SMS (its last line is "@site #123456").
  // iPhone: offers it above the keyboard (autocomplete="one-time-code").
  useEffect(() => {
    if (!otpPhone || typeof window === "undefined" || !("OTPCredential" in window)) return;
    const abort = new AbortController();
    (navigator.credentials.get({ otp: { transport: ["sms"] }, signal: abort.signal } as CredentialRequestOptions) as Promise<(Credential & { code?: string }) | null>)
      .then((otp) => {
        if (!otp?.code) return;
        codeForm.setValue("code", otp.code, { shouldValidate: true });
        void codeForm.handleSubmit(onCodeSubmit)();
      })
      .catch(() => undefined);
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpPhone]);

  // No SMS provider yet: the server hands the code back, so put it in and sign in straight away.
  useEffect(() => {
    if (!shownCode || !otpPhone) return;
    codeForm.setValue("code", shownCode, { shouldValidate: true });
    setShownCode(null);
    void codeForm.handleSubmit(onCodeSubmit)();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownCode, otpPhone]);

  // ---- Continue with Google ----
  const googleClientId = useGoogleClientId();
  const onGoogleCredential = async (credential: string) => {
    try {
      const result = await googleSignIn(credential);
      if (result.status === "signed_in") {
        setSession(result);
        redirectAfterLogin();
        return;
      }
      // A Google account with no business yet: make one (the welcome chat asks the rest).
      showError(t("auth.login.googleNoAccount"));
      navigate("/welcome");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("auth.login.genericError"));
    }
  };

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
      if (result.code) setShownCode(result.code);
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
      if (result.code) setShownCode(result.code);
      else showSuccess(t("auth.otp.codeSent"));
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
      showError(err instanceof ApiError && err.code === "ACCOUNT_SUSPENDED" ? t("errors.accountSuspended") : err instanceof ApiError ? err.message : t("auth.login.genericError"));
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
              onClick={() => {
                setOtpPhone(null);
                setShownCode(null);
              }}
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

          {googleClientId ? (
            <>
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-text-muted">{t("auth.login.or")}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <GoogleSignInButton
                onCredential={(credential) => void onGoogleCredential(credential)}
                onUnavailable={() => showError(t("auth.login.googleUnavailable"))}
                locale={i18n.resolvedLanguage === "en" ? "en" : "hi"}
                width={320}
              >
                <GoogleIcon />
                {t("auth.login.continueWithGoogle")}
              </GoogleSignInButton>
            </>
          ) : null}
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
          label={t("auth.login.emailOrPhone")}
          type="text"
          inputMode="email"
          autoComplete="username"
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
