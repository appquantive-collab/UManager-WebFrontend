import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X } from "lucide-react";

export function BarcodeScannerModal({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result, err) => {
          if (result) {
            onScan(result.getText());
            controlsRef.current?.stop();
          }
          // NotFoundException fires continuously while no code is in frame — not a real error.
          if (err && err.name !== "NotFoundException") {
            setError("Could not access the camera. Check permissions and try again.");
          }
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch(() => {
        setError("Could not access the camera. Check permissions and try again.");
      });

    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-surface p-4 shadow-elevation-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-text">Scan barcode / QR</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        </div>

        {error ? (
          <p className="mt-3 text-sm text-danger">{error}</p>
        ) : (
          <p className="mt-3 text-center text-sm text-text-muted">Point the camera at a barcode or QR code.</p>
        )}
      </div>
    </div>
  );
}
