import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { createCustomer } from "../../lib/customers-api";
import { ApiError } from "../../lib/api";

export function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setName("");
      setPhone("");
      setCreditLimit("");
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not add customer. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    setError(null);
    mutation.mutate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      creditLimit: creditLimit ? Number(creditLimit) : 0,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add customer">
      <div className="space-y-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Traders" autoFocus />
        <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        <TextField
          label="Credit limit (optional)"
          type="number"
          min={0}
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          placeholder="0"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!name.trim() || mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? "Adding…" : "Add customer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
