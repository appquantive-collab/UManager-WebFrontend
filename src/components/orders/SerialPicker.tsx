import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import clsx from "clsx";
import { listSerialsInStock } from "../../lib/stock-api";

/**
 * IMEI / serial numbers for one bill line: type or scan them, or tap one of
 * the pieces in stock. The line's quantity is the number of serials picked.
 */
export function SerialPicker({
  productId,
  value,
  onChange,
}: {
  productId: string;
  value: string[];
  onChange: (serials: string[]) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const inStock = useQuery({ queryKey: ["serials-in-stock", productId], queryFn: () => listSerialsInStock(productId) });

  const add = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    if (parts.length === 0) return;
    onChange([...new Set([...value, ...parts])]);
    setText("");
  };
  const available = (inStock.data ?? []).filter((s) => !value.includes(s));
  const unknown = value.filter((s) => inStock.data && !inStock.data.includes(s));

  return (
    <div className="mt-2 rounded-lg bg-surface-muted p-2.5">
      <label className="text-xs font-semibold text-text" htmlFor={`serial-${productId}`}>
        {t("sale.imeiLabel")}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={`serial-${productId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            }
          }}
          onBlur={() => add(text)}
          placeholder={t("sale.imeiPlaceholder")}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 font-mono text-sm uppercase text-text outline-none focus:border-primary"
        />
      </div>
      {value.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((serial) => (
            <span
              key={serial}
              className={clsx(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs",
                unknown.includes(serial) ? "border-danger text-danger" : "border-border bg-surface text-text"
              )}
            >
              {serial}
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== serial))}
                aria-label={t("sale.removeImei", { serial })}
                className="rounded text-icon outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {unknown.length > 0 ? <p className="mt-1 text-xs font-semibold text-danger">{t("sale.imeiNotInStock")}</p> : null}
      {available.length > 0 ? (
        <div className="mt-2">
          <p className="text-[11px] text-text-muted">{t("sale.imeiInStock")}</p>
          <div className="mt-1 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {available.slice(0, 40).map((serial) => (
              <button
                key={serial}
                type="button"
                onClick={() => onChange([...value, serial])}
                className="rounded-md border border-dashed border-border px-2 py-1 font-mono text-xs text-text outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                + {serial}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
