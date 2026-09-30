import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PickOrCreateField } from "../../components/shared/PickOrCreateField";
import { ApiError } from "../../lib/api";
import {
  createDepartment,
  createDesignation,
  listDepartments,
  listDesignations,
} from "../../lib/staff-api";
import type { CreateStaffInput, DaySchedule, PayType, StaffMember, StaffRole } from "../../lib/staff-api";

const roleOptions: { value: StaffRole; label: string }[] = [
  { value: "MANAGER", label: "Manager" },
  { value: "SALESMAN", label: "Salesman" },
  { value: "WAREHOUSE_STAFF", label: "Warehouse Staff" },
];

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function defaultSchedule(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isDayOff: dayOfWeek === 0,
    startTime: dayOfWeek === 0 ? undefined : "09:00",
    endTime: dayOfWeek === 0 ? undefined : "18:00",
  }));
}

interface StaffFormProps {
  initialValues?: StaffMember;
  onSubmit: (input: CreateStaffInput) => Promise<unknown>;
  onCancel: () => void;
}

export function StaffForm({ initialValues, onSubmit, onCancel }: StaffFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [role, setRole] = useState<StaffRole>(initialValues?.role ?? "SALESMAN");
  const [departmentId, setDepartmentId] = useState<string | null>(initialValues?.departmentId?._id ?? null);
  const [designationId, setDesignationId] = useState<string | null>(initialValues?.designationId?._id ?? null);
  const [schedule, setSchedule] = useState<DaySchedule[]>(initialValues?.weeklySchedule ?? defaultSchedule());
  const [payType, setPayType] = useState<PayType>(initialValues?.payType ?? "salary");
  const [monthlySalary, setMonthlySalary] = useState(initialValues?.monthlySalary?.toString() ?? "");
  const [dailyWage, setDailyWage] = useState(initialValues?.dailyWage?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const designationsQuery = useQuery({ queryKey: ["designations"], queryFn: listDesignations });

  const createDepartmentMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: (dept) => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDepartmentId(dept._id);
    },
  });
  const createDesignationMutation = useMutation({
    mutationFn: createDesignation,
    onSuccess: (des) => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      setDesignationId(des._id);
    },
  });

  const updateDay = (dayOfWeek: number, patch: Partial<DaySchedule>) => {
    setSchedule((current) => current.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
  };

  const canSubmit =
    name.trim().length >= 2 &&
    (payType === "salary" ? Number(monthlySalary) > 0 : Number(dailyWage) > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim() || undefined,
        role,
        departmentId: departmentId ?? undefined,
        designationId: designationId ?? undefined,
        weeklySchedule: schedule,
        payType,
        monthlySalary: payType === "salary" ? Number(monthlySalary) : undefined,
        dailyWage: payType === "daily_wage" ? Number(dailyWage) : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <FormSection title="Basics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
            <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PickOrCreateField
              label="Department (optional)"
              options={(departmentsQuery.data ?? []).map((d) => ({ id: d._id, label: d.name }))}
              value={departmentId}
              onChange={setDepartmentId}
              onCreate={(name) => createDepartmentMutation.mutate(name)}
              isCreating={createDepartmentMutation.isPending}
              placeholder="No department"
            />
            <PickOrCreateField
              label="Designation (optional)"
              options={(designationsQuery.data ?? []).map((d) => ({ id: d._id, label: d.title }))}
              value={designationId}
              onChange={setDesignationId}
              onCreate={(title) => createDesignationMutation.mutate(title)}
              isCreating={createDesignationMutation.isPending}
              placeholder="No designation"
            />
          </div>
        </FormSection>

        <FormSection title="Weekly schedule" subtitle="Set working hours or mark a day off for each day of the week.">
          <div className="space-y-2">
            {schedule.map((day) => (
              <div key={day.dayOfWeek} className="rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text">{dayNames[day.dayOfWeek]}</span>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
                    <input
                      type="checkbox"
                      checked={day.isDayOff}
                      onChange={(e) => updateDay(day.dayOfWeek, { isDayOff: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    Day off
                  </label>
                </div>
                {!day.isDayOff && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="time"
                      value={day.startTime ?? "09:00"}
                      onChange={(e) => updateDay(day.dayOfWeek, { startTime: e.target.value })}
                      className="w-full min-w-0 rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary"
                    />
                    <span className="shrink-0 text-xs text-text-muted">to</span>
                    <input
                      type="time"
                      value={day.endTime ?? "18:00"}
                      onChange={(e) => updateDay(day.dayOfWeek, { endTime: e.target.value })}
                      className="w-full min-w-0 rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </FormSection>
      </div>

      <div className="space-y-6">
        <FormSection title="Pay">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">Pay type</label>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-variant p-1">
              <button
                type="button"
                onClick={() => setPayType("salary")}
                className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  payType === "salary" ? "bg-surface text-text shadow-elevation-1" : "text-text-muted"
                }`}
              >
                Monthly salary
              </button>
              <button
                type="button"
                onClick={() => setPayType("daily_wage")}
                className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  payType === "daily_wage" ? "bg-surface text-text shadow-elevation-1" : "text-text-muted"
                }`}
              >
                Daily wage
              </button>
            </div>
          </div>

          {payType === "salary" ? (
            <TextField
              label="Monthly salary (₹)"
              type="number"
              min={0}
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              placeholder="e.g. 25000"
            />
          ) : (
            <TextField
              label="Daily wage (₹)"
              type="number"
              min={0}
              value={dailyWage}
              onChange={(e) => setDailyWage(e.target.value)}
              placeholder="e.g. 500"
            />
          )}
          <p className="text-xs text-text-muted">
            {payType === "salary"
              ? "Paid in full each month regardless of attendance."
              : "Monthly pay is computed from marked attendance (present days × rate)."}
          </p>
        </FormSection>
      </div>

      {error ? <p className="lg:col-span-3">{<span className="text-sm text-danger">{error}</span>}</p> : null}

      <div className="flex justify-end gap-3 border-t border-border pt-5 lg:col-span-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!canSubmit} isLoading={isSubmitting} onClick={handleSubmit}>
          {initialValues ? "Save changes" : "Add staff"}
        </Button>
      </div>
    </div>
  );
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
