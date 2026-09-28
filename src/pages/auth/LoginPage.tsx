import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useState } from "react";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PhoneField } from "../../components/ui/PhoneField";
import { login, loginByPhone } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { useAuthStore } from "../../lib/auth-store";

const phoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type PhoneFormValues = z.infer<typeof phoneSchema>;

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type CredentialsFormValues = z.infer<typeof credentialsSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [useEmail, setUseEmail] = useState(false);

  const phoneForm = useForm<PhoneFormValues>({ resolver: zodResolver(phoneSchema) });
  const credentialsForm = useForm<CredentialsFormValues>({ resolver: zodResolver(credentialsSchema) });

  const redirectAfterLogin = () => {
    const redirectTo = (location.state as { from?: string })?.from ?? "/app";
    navigate(redirectTo, { replace: true });
  };

  const onPhoneSubmit = async (values: PhoneFormValues) => {
    setFormError(null);
    try {
      const session = await loginByPhone(values.phone, values.password);
      setSession(session);
      redirectAfterLogin();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  const onCredentialsSubmit = async (values: CredentialsFormValues) => {
    setFormError(null);
    try {
      const session = await login(values);
      setSession(session);
      redirectAfterLogin();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (!useEmail) {
    return (
      <AuthLayout title="Welcome back" subtitle="Enter your mobile number to sign in">
        <form className="flex flex-col gap-4" onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} noValidate>
          <PhoneField
            label="Mobile number"
            placeholder="98230 45812"
            error={phoneForm.formState.errors.phone?.message}
            {...phoneForm.register("phone")}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={phoneForm.formState.errors.password?.message}
            {...phoneForm.register("password")}
          />

          {formError ? <p className="text-sm text-danger">{formError}</p> : null}

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" isLoading={phoneForm.formState.isSubmitting} className="w-full">
            Continue
          </Button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-text-muted">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-text-muted opacity-60"
            >
              <WhatsAppIcon />
              WhatsApp
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-text-muted opacity-60"
            >
              <GoogleIcon />
              Google
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          <button
            type="button"
            onClick={() => {
              setUseEmail(true);
              setFormError(null);
            }}
            className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Sign in with email instead
          </button>
        </p>

        <p className="mt-3 text-center text-sm text-text-muted">
          Don&apos;t have a business yet?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in" subtitle="Access your business workspace">
      <form className="flex flex-col gap-4" onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={credentialsForm.formState.errors.email?.message}
          {...credentialsForm.register("email")}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={credentialsForm.formState.errors.password?.message}
          {...credentialsForm.register("password")}
        />

        {formError ? <p className="text-sm text-danger">{formError}</p> : null}

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" isLoading={credentialsForm.formState.isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        <button
          type="button"
          onClick={() => {
            setUseEmail(false);
            setFormError(null);
          }}
          className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Sign in with mobile number instead
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
