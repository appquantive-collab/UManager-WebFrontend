import { useMemo, useState } from "react";
import { Mail, MoreVertical, Plus, ShieldCheck, UserCog } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { SearchInput } from "../../components/ui/SearchInput";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { mockStaff } from "../../lib/mock-data";

const filters = [
  { key: "all", label: "All" },
  { key: "Active", label: "Active" },
  { key: "Invited", label: "Invited" },
  { key: "Suspended", label: "Suspended" },
];

const statusTone = {
  Active: "success",
  Invited: "warning",
  Suspended: "danger",
} as const;

export function StaffPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return mockStaff.filter((member) => {
      const matchesFilter = filter === "all" || member.status === filter;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query || member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [search, filter]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button>
          <Plus size={16} className="mr-1.5" strokeWidth={2.5} />
          Add Staff
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-elevation-1">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff by name or email…" />
        <SegmentedControl segments={filters} active={filter} onChange={setFilter} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No staff members found"
          description="Try a different search or filter, or invite your first team member."
          action={<Button>Add Staff</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-2xl bg-surface p-5 shadow-elevation-1">
              <div className="flex items-center gap-4">
                <Avatar name={member.name} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text">{member.name}</span>
                    <Badge tone={statusTone[member.status as keyof typeof statusTone] ?? "neutral"}>{member.status}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                    <Mail size={13} />
                    {member.email}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                    <ShieldCheck size={13} />
                    {member.role.replace("_", " ")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label={`More actions for ${member.name}`}
                className="rounded-full p-2 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <MoreVertical size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
