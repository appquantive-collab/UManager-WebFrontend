import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { AuthLayout } from "../../layouts/AuthLayout";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";

const schema = z.object({
  identifier: z.string().min(3, "Enter your mobile number or email"),
});
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async () => {
    // Password reset delivery isn't implemented in the backend yet — this
    // confirms the request was captured without claiming an email/SMS went out.
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSent(true);
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your registered mobile number or email and we&rsquo;ll send you an OTP to reset your password.">
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-container text-success">
            <KeyRound size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Reset instructions requested</p>
            <p className="mt-1 text-sm text-text-muted">
              If an account matches, you&apos;ll receive a code shortly. Reset delivery is being finalized for this
              workspace — contact support if it doesn&apos;t arrive.
            </p>
          </div>
          <Link to="/login" className="mt-2 text-sm font-medium text-primary hover:underline">
            Back to Log In
          </Link>
        </div>
      ) : (
        <>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="Mobile number or email"
              placeholder="e.g. +91 98765 43210 or name@domain.co"
              error={errors.identifier?.message}
              {...register("identifier")}
            />

            <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
              Send Reset Code
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            <Link
              to="/login"
              className="font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              ← Back to Log In
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
