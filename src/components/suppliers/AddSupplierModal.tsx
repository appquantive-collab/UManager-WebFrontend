import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { createSupplier } from "../../lib/suppliers-api";
import { ApiError } from "../../lib/api";

export function AddSupplierModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setName("");
      setPhone("");
      setGstin("");
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not add supplier. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    setError(null);
    mutation.mutate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      gstin: gstin.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add supplier">
      <div className="space-y-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coca-Cola Distributors" autoFocus />
        <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        <TextField label="GSTIN (optional)" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="e.g. 09ABCDE1234F1Z5" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!name.trim() || mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? "Adding…" : "Add supplier"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
