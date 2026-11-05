import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { showError } from "../../lib/toast";

function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

export function PayrollTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonthIso());

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
    onError: (err) => showError(err instanceof ApiError ? err.message : t("staff.payrollTab.couldNotGeneratePayroll")),
  });

  const generateAllMutation = useMutation({
    mutationFn: () => generatePayrollForAll(month),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll", month] }),
    onError: (err) => showError(err instanceof ApiError ? err.message : t("staff.payrollTab.couldNotGeneratePayrollForAll")),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => recordPayrollPayment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll", month] }),
    onError: (err) => showError(err instanceof ApiError ? err.message : t("staff.payrollTab.couldNotRecordPayment")),
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
          {t("staff.payrollTab.generateForAllStaff")}
        </Button>
      </div>

      {generateAllMutation.data && generateAllMutation.data.skipped.length > 0 ? (
        <div className="rounded-lg border border-warning/40 bg-warning-container/20 px-4 py-3 text-sm text-warning">
          {t("staff.payrollTab.skipped", {
            count: generateAllMutation.data.skipped.length,
            details: generateAllMutation.data.skipped.map((s) => `${s.name} (${s.reason})`).join(", "),
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">{t("staff.payrollTab.totalPayroll", { month })}</p>
          <p className="mt-1 text-lg font-bold text-text">{formatCurrency(totalNet)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">{t("staff.payrollTab.unpaid")}</p>
          <p className={`mt-1 text-lg font-bold ${totalUnpaid > 0 ? "text-danger" : "text-text"}`}>
            {formatCurrency(totalUnpaid)}
          </p>
        </div>
      </div>

      {staffQuery.isLoading || payrollQuery.isLoading ? (
        <p className="p-6 text-sm text-text-muted">{t("staff.payrollTab.loadingPayroll")}</p>
      ) : activeStaff.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
          {t("staff.payrollTab.noActiveStaff")}
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
                    {member.payType === "salary" ? t("staff.payrollTab.salaried") : t("staff.payrollTab.dailyWage")}
                    {record
                      ? ` · ${t("staff.payrollTab.presentHalfDay", { present: record.presentDays, halfDays: record.halfDays })}`
                      : ""}
                  </p>
                </div>

                {record ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text">{formatCurrency(record.netAmount)}</p>
                      <Badge tone={record.status === "paid" ? "success" : "warning"}>
                        {record.status === "paid" ? t("staff.payrollTab.paid") : t("staff.payrollTab.unpaid")}
                      </Badge>
                    </div>
                    {record.status === "unpaid" ? (
                      <Button
                        variant="secondary"
                        isLoading={payMutation.isPending}
                        onClick={() => payMutation.mutate(record._id)}
                      >
                        <Wallet size={14} className="mr-1.5" />
                        {t("staff.payrollTab.markPaid")}
                      </Button>
                    ) : (
                      <CheckCircle2 size={18} className="text-success" />
                    )}
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    isLoading={generateMutation.isPending}
                    onClick={() => generateMutation.mutate(member._id)}
                  >
                    {t("staff.payrollTab.generate")}
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
