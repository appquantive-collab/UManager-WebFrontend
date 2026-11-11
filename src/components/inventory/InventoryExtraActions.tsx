import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, Shirt } from "lucide-react";
import clsx from "clsx";
import { ImportProductsModal } from "./ImportProductsModal";
import { VariantsModal } from "./VariantsModal";
import { useAuthStore } from "../../lib/auth-store";

/** "Import from Excel" and "Sizes & colours" — shared by the desktop and phone inventory screens. */
export function InventoryExtraActions({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [importOpen, setImportOpen] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const canImport = role === "OWNER" || role === "MANAGER" || role === "SUPER_ADMIN";
  const canAdd = role !== "SALESMAN";

  const button = clsx(
    "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface font-semibold text-text outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40",
    compact ? "min-h-10 flex-1 px-3 text-xs" : "min-h-11 px-4 text-sm"
  );

  return (
    <>
      {canImport ? (
        <button type="button" className={button} onClick={() => setImportOpen(true)}>
          <FileSpreadsheet size={16} className="text-icon" aria-hidden="true" /> {t("importItems.button")}
        </button>
      ) : null}
      {canAdd ? (
        <button type="button" className={button} onClick={() => setVariantsOpen(true)}>
          <Shirt size={16} className="text-icon" aria-hidden="true" /> {t("variants.button")}
        </button>
      ) : null}
      <ImportProductsModal open={importOpen} onClose={() => setImportOpen(false)} />
      <VariantsModal open={variantsOpen} onClose={() => setVariantsOpen(false)} />
    </>
  );
}
