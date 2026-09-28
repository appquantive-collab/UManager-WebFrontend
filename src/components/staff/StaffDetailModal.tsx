import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { PickOrCreateField } from "../shared/PickOrCreateField";
import {
  createDepartment,
  createDesignation,
  listDepartments,
  listDesignations,
  updateStaffMember,
  type StaffMember,
  type StaffRole,
} from "../../lib/staff-api";
import { ApiError } from "../../lib/api";

const roleOptions: { value: StaffRole; label: string }[] = [
  { value: "MANAGER", label: "Manager" },
  { value: "SALESMAN", label: "Salesman" },
  { value: "WAREHOUSE_STAFF", label: "Warehouse Staff" },
];

export function StaffDetailModal({ staff, onClose }: { staff: StaffMember | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("SALESMAN");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [designationId, setDesignationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (staff) {
      setName(staff.name);
      setPhone(staff.phone ?? "");
      setRole(staff.role);
      setDepartmentId(staff.departmentId?._id ?? null);
      setDesignationId(staff.designationId?._id ?? null);
      setError(null);
    }
  }, [staff]);

  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: listDepartments, enabled: !!staff });
  const designationsQuery = useQuery({ queryKey: ["designations"], queryFn: listDesignations, enabled: !!staff });

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

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateStaffMember>[1]) => updateStaffMember(staff!._id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save changes. Please try again."),
  });

  if (!staff) return null;

  const handleSave = () => {
    setError(null);
    updateMutation.mutate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      role,
      departmentId,
      designationId,
    });
  };

  const toggleActive = () => {
    setError(null);
    updateMutation.mutate({ isActive: !staff.isActive });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-surface shadow-elevation-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="flex items-center gap-3">
            <Avatar name={staff.name} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-bold text-text">{staff.name}</h2>
                <Badge tone={staff.isActive ? "success" : "danger"}>{staff.isActive ? "Active" : "Suspended"}</Badge>
              </div>
              {staff.phone ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-muted">
                  <Phone size={13} />
                  {staff.phone}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" />

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

            <PickOrCreateField
              label="Department"
              options={(departmentsQuery.data ?? []).map((d) => ({ id: d._id, label: d.name }))}
              value={departmentId}
              onChange={setDepartmentId}
              onCreate={(name) => createDepartmentMutation.mutate(name)}
              isCreating={createDepartmentMutation.isPending}
              placeholder="No department"
            />

            <PickOrCreateField
              label="Designation"
              options={(designationsQuery.data ?? []).map((d) => ({ id: d._id, label: d.title }))}
              value={designationId}
              onChange={setDesignationId}
              onCreate={(title) => createDesignationMutation.mutate(title)}
              isCreating={createDesignationMutation.isPending}
              placeholder="No designation"
            />

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <div className="flex gap-3 pt-1">
              <Button
                variant={staff.isActive ? "danger" : "secondary"}
                className="flex-1"
                isLoading={updateMutation.isPending}
                onClick={toggleActive}
              >
                {staff.isActive ? "Suspend" : "Reactivate"}
              </Button>
              <Button className="flex-1" disabled={!name.trim()} isLoading={updateMutation.isPending} onClick={handleSave}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
