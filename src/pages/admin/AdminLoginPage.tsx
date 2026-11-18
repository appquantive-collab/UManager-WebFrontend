import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { inputClass } from "../../components/page/kit";
import { adminLogin, useAdminSession } from "../../lib/admin-session";
import { ApiError } from "../../lib/api";

/** Sign-in for the VoiceMunshi team only (English, like the rest of the console). */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const signedIn = useAdminSession((s) => Boolean(s.accessToken));
  const setSession = useAdminSession((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (signedIn) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSession(await adminLogin(email.trim(), password));
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-elevation-2" noValidate>
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="h-11 w-11" />
          <div>
            <p className="flex items-center gap-1.5 text-lg font-extrabold text-text">
              VoiceMunshi Admin <ShieldCheck size={17} className="text-primary" aria-hidden="true" />
            </p>
            <p className="text-sm text-text-muted">Team sign-in</p>
          </div>
        </div>
        <label className="mt-6 block text-sm font-semibold text-text">
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-1.5`} required />
        </label>
        <label className="mt-4 block text-sm font-semibold text-text">
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} mt-1.5`} required />
        </label>
        {error ? (
          <p className="mt-3 rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-5 w-full" disabled={busy || !email || !password}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          Sign in
        </Button>
        <p className="mt-4 text-center text-xs text-text-muted">For the VoiceMunshi team only. Shop owners sign in from the app.</p>
      </form>
    </div>
  );
}
