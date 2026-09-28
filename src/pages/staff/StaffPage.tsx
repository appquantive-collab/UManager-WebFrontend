import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Phone, Plus, ShieldCheck, UserCog } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { SearchInput } from "../../components/ui/SearchInput";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { listStaff, type StaffMember } from "../../lib/staff-api";
import { AddStaffModal } from "../../components/staff/AddStaffModal";
import { StaffDetailModal } from "../../components/staff/StaffDetailModal";

const filters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
];

const roleLabel: Record<StaffMember["role"], string> = {
  MANAGER: "Manager",
  SALESMAN: "Salesman",
  WAREHOUSE_STAFF: "Warehouse Staff",
};

export function StaffPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);

  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const staff = staffQuery.data ?? [];

  const filtered = useMemo(() => {
    return staff.filter((member) => {
      const matchesFilter =
        filter === "all" || (filter === "active" && member.isActive) || (filter === "suspended" && !member.isActive);
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query || member.name.toLowerCase().includes(query) || (member.phone ?? "").includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [staff, search, filter]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" strokeWidth={2.5} />
          Add Staff
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-elevation-1">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff by name or phone…" />
        <SegmentedControl segments={filters} active={filter} onChange={setFilter} />
      </div>

      {staffQuery.isLoading ? (
        <p className="p-6 text-sm text-text-muted">Loading staff…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No staff members found"
          description="Try a different search or filter, or add your first team member."
          action={<Button onClick={() => setAddOpen(true)}>Add Staff</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => (
            <button
              key={member._id}
              type="button"
              onClick={() => setSelected(member)}
              className="flex w-full items-center justify-between rounded-2xl bg-surface p-5 text-left shadow-elevation-1 outline-none transition-shadow hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div className="flex items-center gap-4">
                <Avatar name={member.name} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text">{member.name}</span>
                    <Badge tone={member.isActive ? "success" : "danger"}>{member.isActive ? "Active" : "Suspended"}</Badge>
                  </div>
                  {member.phone ? (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                      <Phone size={13} />
                      {member.phone}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={13} />
                      {roleLabel[member.role]}
                    </span>
                    {member.departmentId ? (
                      <span className="flex items-center gap-1.5">
                        <Building2 size={13} />
                        {member.departmentId.name}
                      </span>
                    ) : null}
                    {member.designationId ? <span>{member.designationId.title}</span> : null}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <AddStaffModal open={addOpen} onClose={() => setAddOpen(false)} />
      <StaffDetailModal staff={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
