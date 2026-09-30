import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Wallet } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatCurrency } from "../../lib/format";
import { listStaff } from "../../lib/staff-api";
import {
  generatePayroll,
  generatePayrollForAll,
  listPayroll,
  recordPayrollPayment,
  type PayrollRecord,
} from "../../lib/payroll-api";
import { ApiError } from "../../lib/api";

function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

export function PayrollTab() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonthIso());
  const [error, setError] = useState<string | null>(null);

  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const payrollQuery = useQuery({ queryKey: ["payroll", month], queryFn: () => listPayroll({ month }) });

  const activeStaff = useMemo(() => (staffQuery.data ?? []).filter((s) => s.isActive), [staffQuery.data]);
  const payrollByStaffId = useMemo(() => {
    const map = new Map<string, PayrollRecord>();
    for (const record of payrollQuery.data ?? []) {
      const staffId = typeof record.staffId === "string" ? record.staffId : record.staffId._id;
      map.set(staffId, record);
    }
    return map;
  }, [payrollQuery.data]);

  const generateMutation = useMutation({
    mutationFn: (staffId: string) => generatePayroll({ staffId, month }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll", month] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not generate payroll."),
  });

  const generateAllMutation = useMutation({
    mutationFn: () => generatePayrollForAll(month),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll", month] }),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => recordPayrollPayment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll", month] }),
  });

  const totalNet = (payrollQuery.data ?? []).reduce((sum, r) => sum + r.netAmount, 0);
  const totalUnpaid = (payrollQuery.data ?? [])
    .filter((r) => r.status === "unpaid")
    .reduce((sum, r) => sum + r.netAmount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-text-muted" />
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
          />
        </div>
        <Button isLoading={generateAllMutation.isPending} onClick={() => generateAllMutation.mutate()}>
          Generate for all staff
        </Button>
      </div>

      {generateAllMutation.data && generateAllMutation.data.skipped.length > 0 ? (
        <div className="rounded-lg border border-warning/40 bg-warning-container/20 px-4 py-3 text-sm text-warning">
          Skipped {generateAllMutation.data.skipped.length}:{" "}
          {generateAllMutation.data.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Total payroll ({month})</p>
          <p className="mt-1 text-lg font-bold text-text">{formatCurrency(totalNet)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Unpaid</p>
          <p className={`mt-1 text-lg font-bold ${totalUnpaid > 0 ? "text-danger" : "text-text"}`}>
            {formatCurrency(totalUnpaid)}
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {staffQuery.isLoading || payrollQuery.isLoading ? (
        <p className="p-6 text-sm text-text-muted">Loading payroll…</p>
      ) : activeStaff.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
          No active staff members yet.
        </p>
      ) : (
        <div className="space-y-2">
          {activeStaff.map((member) => {
            const record = payrollByStaffId.get(member._id);
            return (
              <div
                key={member._id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{member.name}</p>
                  <p className="text-xs text-text-muted">
                    {member.payType === "salary" ? "Salaried" : "Daily wage"}
                    {record ? ` · ${record.presentDays} present, ${record.halfDays} half-day` : ""}
                  </p>
                </div>

                {record ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text">{formatCurrency(record.netAmount)}</p>
                      <Badge tone={record.status === "paid" ? "success" : "warning"}>
                        {record.status === "paid" ? "Paid" : "Unpaid"}
                      </Badge>
                    </div>
                    {record.status === "unpaid" ? (
                      <Button
                        variant="secondary"
                        isLoading={payMutation.isPending}
                        onClick={() => payMutation.mutate(record._id)}
                      >
                        <Wallet size={14} className="mr-1.5" />
                        Mark paid
                      </Button>
                    ) : (
                      <CheckCircle2 size={18} className="text-success" />
                    )}
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    isLoading={generateMutation.isPending}
                    onClick={() => {
                      setError(null);
                      generateMutation.mutate(member._id);
                    }}
                  >
                    Generate
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
