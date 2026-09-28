import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { PickOrCreateField } from "../shared/PickOrCreateField";
import {
  createDepartment,
  createDesignation,
  createStaffMember,
  listDepartments,
  listDesignations,
  type StaffRole,
} from "../../lib/staff-api";
import { ApiError } from "../../lib/api";

const roleOptions: { value: StaffRole; label: string }[] = [
  { value: "MANAGER", label: "Manager" },
  { value: "SALESMAN", label: "Salesman" },
  { value: "WAREHOUSE_STAFF", label: "Warehouse Staff" },
];

export function AddStaffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("SALESMAN");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [designationId, setDesignationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: listDepartments, enabled: open });
  const designationsQuery = useQuery({ queryKey: ["designations"], queryFn: listDesignations, enabled: open });

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

  const createStaffMutation = useMutation({
    mutationFn: createStaffMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      reset();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add staff member. Please try again."),
  });

  const reset = () => {
    setName("");
    setPhone("");
    setRole("SALESMAN");
    setDepartmentId(null);
    setDesignationId(null);
    setError(null);
  };

  const canSubmit = name.trim().length >= 2;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    createStaffMutation.mutate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      role,
      departmentId: departmentId ?? undefined,
      designationId: designationId ?? undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add staff member"
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
        <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" />

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

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!canSubmit} isLoading={createStaffMutation.isPending} onClick={handleSubmit}>
            Add staff
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
