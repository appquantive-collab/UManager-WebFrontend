import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useState } from "react";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PhoneField } from "../../components/ui/PhoneField";
import { SuccessModal } from "../../components/ui/SuccessModal";
import { register as registerTenant } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { useAuthStore } from "../../lib/auth-store";

const registerSchema = z.object({
  ownerName: z.string().min(2, "Your name is required"),
  businessName: z.string().min(2, "Business name is required"),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  agreeToTerms: z.literal(true, { message: "You must agree to the Terms & Privacy Policy" }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);
    try {
      const session = await registerTenant({
        businessName: values.businessName,
        businessType: "Wholesale",
        ownerName: values.ownerName,
        email: values.email,
        password: values.password,
        phone: values.phone,
      });
      setSession(session);
      setShowSuccess(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <AuthLayout title="Get started with wholesale" subtitle="Set up your wholesale account in just a minute">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Full name"
          autoComplete="name"
          error={errors.ownerName?.message}
          {...registerField("ownerName")}
        />
        <TextField
          label="Business name"
          autoComplete="organization"
          placeholder="e.g. Sharma Traders & Distributors"
          error={errors.businessName?.message}
          {...registerField("businessName")}
        />
        <PhoneField
          label="Mobile number"
          placeholder="98230 45812"
          error={errors.phone?.message}
          {...registerField("phone")}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...registerField("email")}
        />
        <TextField
          label="Create password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...registerField("password")}
        />

        <label className="flex items-start gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            {...registerField("agreeToTerms")}
          />
          <span>
            I agree to the{" "}
            <a href="#" className="font-medium text-primary hover:underline">
              Terms
            </a>{" "}
            &amp;{" "}
            <a href="#" className="font-medium text-primary hover:underline">
              Privacy Policy
            </a>
          </span>
        </label>
        {errors.agreeToTerms ? <p className="-mt-2 text-xs text-danger">{errors.agreeToTerms.message}</p> : null}

        {formError ? <p className="text-sm text-danger">{formError}</p> : null}

        <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full">
          Create Wholesale Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Log In
        </Link>
      </p>

      <SuccessModal
        open={showSuccess}
        title="Account created!"
        message="Your wholesale workspace is ready."
        redirectSeconds={3}
        onComplete={() => navigate("/app", { replace: true })}
      />
    </AuthLayout>
  );
}
