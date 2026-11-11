import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import clsx from "clsx";
import { Button } from "../ui/Button";
import { ModalShell } from "../page/kit";
import { importProducts, type ImportResult } from "../../lib/products-api";
import { readItemSheet, TEMPLATE_CSV, type ParsedSheet } from "../../lib/sheet-import";
import { errorMessage } from "../../lib/api-errors";
import { showError } from "../../lib/toast";

/** Bring a whole item list in from Excel or CSV: pick file → check → import. */
export function ImportProductsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [mode, setMode] = useState<"update" | "skip">("update");
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (open) return;
    setSheet(null);
    setFileName("");
    setResult(null);
    setMode("update");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => importProducts(sheet!.rows, mode),
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setResult(null);
    try {
      const parsed = await readItemSheet(file);
      setSheet(parsed);
      setFileName(file.name);
    } catch {
      showError(t("importItems.readFailed"));
    } finally {
      setReading(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sethsathi-items-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasName = sheet?.columns.includes("name") ?? false;
  const mapped = sheet ? sheet.columns.map((c, i) => ({ header: sheet.headers[i], field: c })).filter((m) => m.header) : [];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t("importItems.title")}
      subtitle={t("importItems.subtitle")}
      closeLabel={t("common.close")}
      footer={
        result ? (
          <Button className="w-full" onClick={onClose}>
            {t("importItems.done")}
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button className="flex-1" disabled={!sheet || !hasName || sheet.rows.length === 0} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
              {sheet ? t("importItems.importN", { count: sheet.rows.length }) : t("importItems.import")}
            </Button>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              [t("importItems.created"), result.created],
              [t("importItems.updated"), result.updated + result.skipped],
              [t("importItems.problems"), result.errorCount],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border px-2 py-3">
                <p className="text-2xl font-bold tabular-nums text-text">{value}</p>
                <p className="text-xs text-text-muted">{label}</p>
              </div>
            ))}
          </div>
          {result.errors.length > 0 ? (
            <div className="rounded-xl border border-border">
              <p className="border-b border-border px-3.5 py-2 text-sm font-semibold text-text">{t("importItems.fixThese")}</p>
              <ul className="max-h-56 divide-y divide-border overflow-y-auto text-sm">
                {result.errors.map((e) => (
                  <li key={e.row} className="px-3.5 py-2 text-text">
                    <span className="font-semibold">{t("importItems.row", { row: e.row })}</span> · <span className="text-text-muted">{e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center outline-none hover:border-primary/50 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {sheet ? <FileSpreadsheet size={26} className="text-icon" aria-hidden="true" /> : <Upload size={26} className="text-icon" aria-hidden="true" />}
            <span className="text-sm font-semibold text-text">{reading ? t("common.loading") : sheet ? fileName : t("importItems.pick")}</span>
            <span className="text-xs text-text-muted">{sheet ? t("importItems.rowsFound", { count: sheet.rows.length }) : t("importItems.formats")}</span>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />

          <button
            type="button"
            onClick={downloadTemplate}
            className="flex min-h-11 items-center gap-2 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Download size={15} aria-hidden="true" /> {t("importItems.template")}
          </button>

          {sheet ? (
            <>
              {!hasName ? <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm font-semibold text-danger">{t("importItems.noName")}</p> : null}
              <div className="rounded-xl border border-border">
                <p className="border-b border-border px-3.5 py-2 text-sm font-semibold text-text">{t("importItems.columns")}</p>
                <ul className="divide-y divide-border text-sm">
                  {mapped.map((m, i) => (
                    <li key={i} className="flex justify-between gap-3 px-3.5 py-2">
                      <span className="truncate text-text">{m.header}</span>
                      <span className={clsx("shrink-0", m.field ? "font-semibold text-text" : "text-text-muted")}>
                        {m.field ? t(`importItems.field.${m.field}`) : t("importItems.ignored")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-text">{t("importItems.existing")}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(["update", "skip"] as const).map((m) => (
                    <label key={m} className={clsx("flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5", mode === m ? "border-text" : "border-border")}>
                      <input type="radio" name="import-mode" checked={mode === m} onChange={() => setMode(m)} className="mt-0.5 accent-primary" />
                      <span className="text-sm text-text">{t(`importItems.mode.${m}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <p className="text-xs text-text-muted">{t("importItems.help")}</p>
          )}
        </div>
      )}
    </ModalShell>
  );
}
