import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface SuccessModalProps {
  open: boolean;
  title: string;
  message: string;
  redirectSeconds?: number;
  onComplete: () => void;
}

export function SuccessModal({ open, title, message, redirectSeconds = 3, onComplete }: SuccessModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(redirectSeconds);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(redirectSeconds);

    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    const timeout = setTimeout(onComplete, redirectSeconds * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, redirectSeconds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-7 text-center shadow-elevation-3">
        <span
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success"
          style={{ animation: "success-pop 450ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        >
          <CheckCircle2 size={32} />
        </span>

        <h2 className="mt-5 text-xl font-bold tracking-tight text-text">{title}</h2>
        <p className="mt-1.5 text-sm text-text-muted">{message}</p>

        <p className="mt-5 text-xs font-medium text-text-muted">
          Redirecting to your dashboard in {secondsLeft}s…
        </p>

        <style>{`
          @keyframes success-pop {
            0% { opacity: 0; transform: scale(0.6); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}
