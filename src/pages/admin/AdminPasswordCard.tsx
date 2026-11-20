import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { inputClass } from "../../components/page/kit";
import { changeAdminPassword } from "../../lib/admin-session";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";

/** Change the signed-in admin's password. */
export function AdminPasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: () => changeAdminPassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      showSuccess("Password changed");
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : "Couldn't change the password"),
  });
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <KeyRound size={18} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
        <div>
          <h3 className="text-base font-bold text-text">Your admin password</h3>
          <p className="text-sm text-text-muted">At least 10 characters. Other admins aren't affected.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-text-muted">
          Current password
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-text-muted">
          New password
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
      </div>
      <Button className="mt-3" isLoading={change.isPending} disabled={!current || next.length < 10} onClick={() => change.mutate()}>
        Change password
      </Button>
    </section>
  );
}
