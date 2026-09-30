import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createStaffMember, listStaff, updateStaffMember, type CreateStaffInput } from "../../lib/staff-api";
import { StaffForm } from "./StaffForm";

export function StaffFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // No single-staff GET endpoint exists yet — the list is already fetched
  // everywhere else in this app and is cheap, so reuse it instead of adding one.
  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: listStaff, enabled: isEdit });
  const staffMember = staffQuery.data?.find((s) => s._id === id);

  const createMutation = useMutation({
    mutationFn: (input: CreateStaffInput) => createStaffMember(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      navigate("/app/staff");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: CreateStaffInput) => updateStaffMember(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      navigate("/app/staff");
    },
  });

  const goBack = () => navigate("/app/staff");

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back to staff"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">{isEdit ? "Edit staff member" : "Add staff member"}</h1>
          <p className="text-xs text-text-muted">
            {isEdit ? "Update role, schedule, or pay details." : "Add a new team member, their schedule, and pay."}
          </p>
        </div>
      </div>

      {isEdit && staffQuery.isLoading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
          Loading staff member…
        </div>
      ) : isEdit && !staffMember ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-danger">
          Could not find this staff member.
        </div>
      ) : (
        <StaffForm
          initialValues={staffMember}
          onCancel={goBack}
          onSubmit={(input) => (isEdit ? updateMutation.mutateAsync(input) : createMutation.mutateAsync(input))}
        />
      )}
    </div>
  );
}
