import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Calendar, Check } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { listStaff, type StaffMember } from "../../lib/staff-api";
import { bulkMarkAttendance, listAttendance, type AttendanceStatus } from "../../lib/attendance-api";

const statusOptions: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: "present", label: "Present", activeClass: "bg-success text-white" },
  { value: "half_day", label: "Half Day", activeClass: "bg-warning text-white" },
  { value: "absent", label: "Absent", activeClass: "bg-danger text-white" },
  { value: "leave", label: "Leave", activeClass: "bg-info text-white" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceTab() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});

  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const attendanceQuery = useQuery({
    queryKey: ["attendance", date],
    queryFn: () => listAttendance({ date }),
  });

  const activeStaff = useMemo(() => (staffQuery.data ?? []).filter((s) => s.isActive), [staffQuery.data]);

  const existingByStaffId = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const record of attendanceQuery.data ?? []) {
      const staffId = typeof record.staffId === "string" ? record.staffId : record.staffId._id;
      map.set(staffId, record.status);
    }
    return map;
  }, [attendanceQuery.data]);

  useEffect(() => {
    setDraft({});
  }, [date]);

  const statusFor = (staffId: string): AttendanceStatus | null => draft[staffId] ?? existingByStaffId.get(staffId) ?? null;

  const setStatus = (staffId: string, status: AttendanceStatus) => {
    setDraft((current) => ({ ...current, [staffId]: status }));
  };

  const bulkMutation = useMutation({
    mutationFn: bulkMarkAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", date] });
      setDraft({});
    },
  });

  const pendingEntries = Object.entries(draft);
  const canSave = pendingEntries.length > 0;

  const handleSaveAll = () => {
    if (!canSave) return;
    bulkMutation.mutate({
      date,
      entries: pendingEntries.map(([staffId, status]) => ({ staffId, status })),
    });
  };

  const markAllPresent = () => {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of activeStaff) {
      if (!existingByStaffId.has(s._id)) next[s._id] = "present";
    }
    setDraft((current) => ({ ...next, ...current }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-text-muted" />
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={markAllPresent}>
            Mark all present
          </Button>
          <Button disabled={!canSave} isLoading={bulkMutation.isPending} onClick={handleSaveAll}>
            <Check size={15} className="mr-1.5" />
            Save {pendingEntries.length > 0 ? `(${pendingEntries.length})` : ""}
          </Button>
        </div>
      </div>

      {staffQuery.isLoading || attendanceQuery.isLoading ? (
        <p className="p-6 text-sm text-text-muted">Loading attendance…</p>
      ) : activeStaff.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
          No active staff members yet.
        </p>
      ) : (
        <div className="space-y-2">
          {activeStaff.map((member: StaffMember) => {
            const status = statusFor(member._id);
            return (
              <div
                key={member._id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{member.name}</p>
                  <p className="text-xs text-text-muted">{member.role.replace("_", " ")}</p>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(member._id, opt.value)}
                      className={clsx(
                        "rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                        status === opt.value ? opt.activeClass : "border border-border bg-surface-variant text-text-muted hover:text-text"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
