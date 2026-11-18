import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { ModalShell, inputClass } from "../../components/page/kit";

/**
 * Last stop before a permanent delete: says exactly what goes, and the
 * delete button only works once the exact name is typed.
 */
export function ConfirmDeleteModal({
  open,
  title,
  lines,
  confirmName,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  /** What will be deleted, one point per line. */
  lines: string[];
  /** The name that must be typed. */
  confirmName: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === confirmName.trim().toLowerCase();
  const close = () => {
    setTyped("");
    onClose();
  };
  return (
    <ModalShell open={open} onClose={close} title={title} closeLabel="Close">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-danger px-3.5 py-3 text-sm font-medium text-white" role="alert">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">This can't be undone.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
        <label className="block text-sm font-semibold text-text">
          Type <span className="rounded bg-surface-variant px-1.5 py-0.5 font-mono">{confirmName}</span> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={`${inputClass} mt-1.5`} autoComplete="off" spellCheck={false} />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!matches || busy}
            onClick={onConfirm}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-danger px-4 text-sm font-semibold text-white outline-none hover:bg-danger/90 focus-visible:ring-2 focus-visible:ring-danger/40 disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
            Delete permanently
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
