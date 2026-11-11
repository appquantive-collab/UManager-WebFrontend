import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { Field, ModalShell, inputClass } from "../page/kit";
import { createVariants } from "../../lib/products-api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

const SIZE_PRESETS: Record<string, string[]> = {
  clothes: ["S", "M", "L", "XL", "XXL"],
  kids: ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-11Y"],
  shoes: ["6", "7", "8", "9", "10"],
};

function TagInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...values, ...parts])]);
    setText("");
  };
  return (
    <div>
      <p className="text-sm font-semibold text-text">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm text-text">
            {v}
            <button type="button" aria-label={`× ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="text-icon outline-none hover:text-danger">
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          aria-label={label}
          className="h-9 min-w-28 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}

/** Garments/footwear: one design × sizes × colours → one item each, in one go. */
export function VariantsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [baseName, setBaseName] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [retail, setRetail] = useState("");
  const [cost, setCost] = useState("");
  const [gst, setGst] = useState("5");
  const [hsn, setHsn] = useState("");

  useEffect(() => {
    if (open) return;
    setBaseName("");
    setSizes([]);
    setColors([]);
    setRetail("");
    setCost("");
    setGst("5");
    setHsn("");
  }, [open]);

  const count = Math.max(1, sizes.length) * Math.max(1, colors.length);
  const mutation = useMutation({
    mutationFn: () =>
      createVariants({
        baseName: baseName.trim(),
        sizes,
        colors,
        retailPrice: Number(retail) || 0,
        wholesalePrice: Number(retail) || 0,
        purchasePrice: Number(cost) || 0,
        gstPercent: Number(gst) || 0,
        hsn: hsn.trim() || undefined,
      }),
    onSuccess: (items) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      showSuccess(t("variants.created", { count: items.length }));
      onClose();
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t("variants.title")}
      subtitle={t("variants.subtitle")}
      closeLabel={t("common.close")}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" disabled={!baseName.trim() || (sizes.length === 0 && colors.length === 0) || count > 200} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("variants.create", { count })}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("variants.design")} hint={t("variants.designHint")} htmlFor="v-name">
          <input id="v-name" className={inputClass} value={baseName} onChange={(e) => setBaseName(e.target.value)} placeholder={t("variants.designPlaceholder")} />
        </Field>
        <div>
          <TagInput label={t("variants.sizes")} values={sizes} onChange={setSizes} placeholder={t("variants.typeAndEnter")} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(SIZE_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSizes(preset)}
                className="min-h-9 rounded-full border border-dashed border-border px-3 text-xs font-semibold text-text outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {t(`variants.preset.${key}`)}: {preset.join(", ")}
              </button>
            ))}
          </div>
        </div>
        <TagInput label={t("variants.colors")} values={colors} onChange={setColors} placeholder={t("variants.colorsPlaceholder")} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t("variants.price")} htmlFor="v-price">
            <input id="v-price" type="number" inputMode="decimal" className={inputClass} value={retail} onChange={(e) => setRetail(e.target.value)} />
          </Field>
          <Field label={t("variants.cost")} htmlFor="v-cost">
            <input id="v-cost" type="number" inputMode="decimal" className={inputClass} value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          <Field label="GST %" htmlFor="v-gst">
            <select id="v-gst" className={inputClass} value={gst} onChange={(e) => setGst(e.target.value)}>
              {[0, 5, 12, 18, 28].map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </Field>
          <Field label="HSN" htmlFor="v-hsn">
            <input id="v-hsn" inputMode="numeric" className={inputClass} value={hsn} onChange={(e) => setHsn(e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </Field>
        </div>
        {baseName.trim() && (sizes.length || colors.length) ? (
          <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm text-text">
            {t("variants.preview", {
              example: `${baseName.trim()} - ${[sizes[0], colors[0]].filter(Boolean).join(" / ")}`,
              count,
            })}
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}
