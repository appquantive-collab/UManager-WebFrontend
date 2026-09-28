import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { createWarehouse } from "../../lib/warehouses-api";
import { ApiError } from "../../lib/api";

export function AddWarehouseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setName("");
      setLocation("");
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not add warehouse. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    setError(null);
    mutation.mutate({ name: name.trim(), location: location.trim() || undefined });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add warehouse">
      <div className="space-y-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Noida Warehouse" autoFocus />
        <TextField label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Sector 63, Noida" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!name.trim() || mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? "Adding…" : "Add warehouse"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
