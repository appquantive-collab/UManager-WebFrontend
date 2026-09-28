import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { getProductQr } from "../../lib/products-api";
import { Button } from "../ui/Button";

export function ProductQrModal({
  productId,
  productName,
  onClose,
}: {
  productId: string | null;
  productName?: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["product-qr", productId],
    queryFn: () => getProductQr(productId!),
    enabled: !!productId,
  });

  if (!productId) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-xs rounded-2xl bg-surface p-6 text-center shadow-elevation-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        <h2 className="text-base font-bold text-text">{productName ?? "Product QR code"}</h2>

        {query.isLoading ? (
          <p className="mt-6 text-sm text-text-muted">Generating…</p>
        ) : query.data ? (
          <>
            <img
              src={query.data.qrDataUrl}
              alt={`QR code for SKU ${query.data.sku}`}
              className="mx-auto mt-4 h-48 w-48 rounded-lg border border-border"
            />
            <p className="mt-2 text-xs text-text-muted">SKU: {query.data.sku}</p>
            <a href={query.data.qrDataUrl} download={`${query.data.sku}-qr.png`} className="mt-4 block">
              <Button className="w-full">
                <Download size={16} className="mr-1.5" strokeWidth={2} />
                Download
              </Button>
            </a>
          </>
        ) : (
          <p className="mt-6 text-sm text-danger">Could not generate the QR code.</p>
        )}
      </div>
    </div>
  );
}
