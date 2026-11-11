import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PickOrCreateField } from "../../components/shared/PickOrCreateField";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import {
  createDepartment,
  createDesignation,
  listDepartments,
  listDesignations,
} from "../../lib/staff-api";
import type { CreateStaffInput, DaySchedule, PayType, StaffMember, StaffRole } from "../../lib/staff-api";
import i18n from "../../lib/i18n";

function buildStaffSchema(payType: PayType) {
  return z
    .object({
      name: z.string().min(2, { error: () => i18n.t("staff.staffForm.nameTooShort") }),
      phone: z.string().optional(),
      monthlySalary: z.coerce.number().optional(),
      dailyWage: z.coerce.number().optional(),
    })
    .superRefine((values, ctx) => {
      if (payType === "salary" && !(values.monthlySalary && values.monthlySalary > 0)) {
        ctx.addIssue({ code: "custom", path: ["monthlySalary"], message: i18n.t("staff.staffForm.mustBeGreaterThanZero") });
      }
      if (payType === "daily_wage" && !(values.dailyWage && values.dailyWage > 0)) {
        ctx.addIssue({ code: "custom", path: ["dailyWage"], message: i18n.t("staff.staffForm.mustBeGreaterThanZero") });
      }
    });
}
type StaffFormInput = z.input<ReturnType<typeof buildStaffSchema>>;
type StaffFormValues = z.output<ReturnType<typeof buildStaffSchema>>;

const roleOptionKeys: { value: StaffRole; labelKey: string }[] = [
  { value: "MANAGER", labelKey: "staff.roles.manager" },
  { value: "SALESMAN", labelKey: "staff.roles.salesman" },
  { value: "WAREHOUSE_STAFF", labelKey: "staff.roles.warehouseStaff" },
];

const dayNameKeys = [
  "staff.staffForm.days.sunday",
  "staff.staffForm.days.monday",
  "staff.staffForm.days.tuesday",
  "staff.staffForm.days.wednesday",
  "staff.staffForm.days.thursday",
  "staff.staffForm.days.friday",
  "staff.staffForm.days.saturday",
];

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<StaffRole>(initialValues?.role ?? "SALESMAN");
  const [departmentId, setDepartmentId] = useState<string | null>(initialValues?.departmentId?._id ?? null);
  const [designationId, setDesignationId] = useState<string | null>(initialValues?.designationId?._id ?? null);
  const [schedule, setSchedule] = useState<DaySchedule[]>(initialValues?.weeklySchedule ?? defaultSchedule());
  const [payType, setPayType] = useState<PayType>(initialValues?.payType ?? "salary");

  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const designationsQuery = useQuery({ queryKey: ["designations"], queryFn: listDesignations });

  const createDepartmentMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: (dept) => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDepartmentId(dept._id);
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("staff.staffForm.couldNotCreateDepartment"));
    },
  });
  const createDesignationMutation = useMutation({
    mutationFn: createDesignation,
    onSuccess: (des) => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      setDesignationId(des._id);
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("staff.staffForm.couldNotCreateDesignation"));
    },
  });

  const updateDay = (dayOfWeek: number, patch: Partial<DaySchedule>) => {
    setSchedule((current) => current.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
  };

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormInput, unknown, StaffFormValues>({
    resolver: zodResolver(buildStaffSchema(payType)),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: initialValues?.name ?? "",
      phone: initialValues?.phone ?? "",
      monthlySalary: initialValues?.monthlySalary,
      dailyWage: initialValues?.dailyWage,
    },
  });

  useEffect(() => {
    trigger(["monthlySalary", "dailyWage"]);
  }, [payType, trigger]);

  const submit = async (values: StaffFormValues) => {
    try {
      await onSubmit({
        name: values.name.trim(),
        phone: values.phone?.trim() || undefined,
        role,
        departmentId: departmentId ?? undefined,
        designationId: designationId ?? undefined,
        weeklySchedule: schedule,
        payType,
        monthlySalary: payType === "salary" ? values.monthlySalary : undefined,
        dailyWage: payType === "daily_wage" ? values.dailyWage : undefined,
      });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("staff.staffForm.genericError"));
    }
  };

  return (
    <form className="grid grid-cols-1 gap-6 lg:grid-cols-3" onSubmit={handleSubmit(submit)} noValidate>
      <div className="space-y-6 lg:col-span-2">
        <FormSection title={t("staff.staffForm.basics")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("staff.staffForm.name")}
              placeholder={t("staff.staffForm.namePlaceholder")}
              autoFocus
              error={errors.name?.message}
              {...register("name")}
            />
            <TextField
              label={t("staff.staffForm.phoneOptional")}
              placeholder={t("staff.staffForm.phonePlaceholder")}
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-text">{t("staff.staffForm.role")}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
            >
              {roleOptionKeys.map((r) => (
                <option key={r.value} value={r.value}>
                  {t(r.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PickOrCreateField
              label={t("staff.staffForm.departmentOptional")}
              options={(departmentsQuery.data ?? []).map((d) => ({ id: d._id, label: d.name }))}
              value={departmentId}
              onChange={setDepartmentId}
              onCreate={(name) => createDepartmentMutation.mutate(name)}
              isCreating={createDepartmentMutation.isPending}
              placeholder={t("staff.staffForm.noDepartment")}
            />
            <PickOrCreateField
              label={t("staff.staffForm.designationOptional")}
              options={(designationsQuery.data ?? []).map((d) => ({ id: d._id, label: d.title }))}
              value={designationId}
              onChange={setDesignationId}
              onCreate={(title) => createDesignationMutation.mutate(title)}
              isCreating={createDesignationMutation.isPending}
              placeholder={t("staff.staffForm.noDesignation")}
            />
          </div>
        </FormSection>

        <FormSection title={t("staff.staffForm.weeklySchedule")} subtitle={t("staff.staffForm.weeklyScheduleSubtitle")}>
          <div className="space-y-2">
            {schedule.map((day) => (
              <div key={day.dayOfWeek} className="rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text">{t(dayNameKeys[day.dayOfWeek])}</span>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-text">
                    <input
                      type="checkbox"
                      checked={day.isDayOff}
                      onChange={(e) => updateDay(day.dayOfWeek, { isDayOff: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    {t("staff.staffForm.dayOff")}
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
                    <span className="shrink-0 text-xs text-text-muted">{t("staff.staffForm.to")}</span>
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
        <FormSection title={t("staff.staffForm.pay")}>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-text">{t("staff.staffForm.payType")}</label>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-variant p-1">
              <button
                type="button"
                onClick={() => setPayType("salary")}
                className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  payType === "salary" ? "bg-surface text-text shadow-elevation-1" : "text-text-muted"
                }`}
              >
                {t("staff.staffForm.monthlySalary")}
              </button>
              <button
                type="button"
                onClick={() => setPayType("daily_wage")}
                className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  payType === "daily_wage" ? "bg-surface text-text shadow-elevation-1" : "text-text-muted"
                }`}
              >
                {t("staff.staffForm.dailyWage")}
              </button>
            </div>
          </div>

          {payType === "salary" ? (
            <TextField
              label={t("staff.staffForm.monthlySalaryCurrency")}
              type="number"
              min={0}
              placeholder={t("staff.staffForm.monthlySalaryPlaceholder")}
              error={errors.monthlySalary?.message}
              {...register("monthlySalary")}
            />
          ) : (
            <TextField
              label={t("staff.staffForm.dailyWageCurrency")}
              type="number"
              min={0}
              placeholder={t("staff.staffForm.dailyWagePlaceholder")}
              error={errors.dailyWage?.message}
              {...register("dailyWage")}
            />
          )}
          <p className="text-xs text-text-muted">
            {payType === "salary" ? t("staff.staffForm.salaryHint") : t("staff.staffForm.dailyWageHint")}
          </p>
        </FormSection>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-5 lg:col-span-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("staff.staffForm.cancel")}
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initialValues ? t("staff.staffForm.saveChanges") : t("staff.staffForm.addStaff")}
        </Button>
      </div>
    </form>
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
