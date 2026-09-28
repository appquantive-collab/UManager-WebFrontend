import { useState } from "react";
import { Plus } from "lucide-react";

interface Option {
  id: string;
  label: string;
}

export function PickOrCreateField({
  label,
  options,
  value,
  onChange,
  onCreate,
  isCreating,
  placeholder,
}: {
  label: string;
  options: Option[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate: (label: string) => void;
  isCreating: boolean;
  placeholder: string;
}) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text-muted">{label}</label>
      {!creatingNew ? (
        <div className="flex gap-2">
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
          >
            <option value="">{placeholder}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreatingNew(true)}
            aria-label={`Add new ${label.toLowerCase()}`}
            className="flex shrink-0 items-center justify-center rounded-lg border border-border px-3 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plus size={16} />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={`New ${label.toLowerCase()}…`}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCreatingNew(false);
                setNewLabel("");
              }}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text-muted outline-none transition-colors hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!newLabel.trim() || isCreating}
              onClick={() => {
                onCreate(newLabel.trim());
                setNewLabel("");
                setCreatingNew(false);
              }}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary outline-none transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {isCreating ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
