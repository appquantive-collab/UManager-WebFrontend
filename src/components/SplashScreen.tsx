import { useEffect, useState } from "react";

const MIN_VISIBLE_MS = 3000;
const FADE_MS = 350;

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"show" | "fade" | "hidden">("show");

  useEffect(() => {
    if (phase !== "show") return;

    const timer = setTimeout(() => {
      setPhase("fade");
    }, MIN_VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fade") return;
    const timer = setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <>
      {children}
      {phase !== "hidden" && (
        <div
          className="fixed inset-0 z-100 flex flex-col overflow-hidden bg-background transition-opacity"
          style={{
            opacity: phase === "fade" ? 0 : 1,
            transitionDuration: `${FADE_MS}ms`,
          }}
          aria-hidden="true"
        >
          {/* Dot-grid texture, matching the reference splash's engineered/technical feel */}
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              maskImage: "radial-gradient(circle at center, black, transparent 70%)",
            }}
          />

          <div className="relative flex items-center justify-center pt-[max(1.5rem,env(safe-area-inset-top))]">
            <span
              className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted opacity-0"
              style={{ animation: "splash-fade-up 400ms ease-out 100ms forwards" }}
            >
              System 4.2 Initializing
            </span>
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center px-6">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div
                className="absolute inset-0 rounded-3xl opacity-70 blur-2xl"
                style={{ background: "radial-gradient(closest-side, var(--color-primary-container), transparent)" }}
              />
              <div
                className="absolute inset-0 rounded-3xl border-2 border-primary/25"
                style={{ animation: "splash-ring-pulse 2200ms ease-in-out infinite" }}
              />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-surface shadow-elevation-3">
                <img
                  src="/logo-192.png"
                  alt=""
                  className="h-11 w-11 object-contain"
                  style={{ animation: "splash-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                />
              </div>
            </div>

            <span
              className="relative mt-6 font-headline text-xl font-bold tracking-tight text-text opacity-0"
              style={{ animation: "splash-fade-up 500ms ease-out 200ms forwards" }}
            >
              UManager
            </span>
            <span
              className="relative mt-1 text-sm text-text-muted opacity-0"
              style={{ animation: "splash-fade-up 500ms ease-out 300ms forwards" }}
            >
              Intelligent Wholesale OS
            </span>

            <span
              className="relative mt-7 h-1.5 w-1.5 rounded-full bg-primary opacity-0"
              style={{ animation: "splash-fade-up 400ms ease-out 450ms forwards, splash-dot-pulse 1100ms ease-in-out 850ms infinite" }}
            />
          </div>

          <div className="relative flex flex-col items-center gap-1 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
            <span
              className="flex items-center gap-1.5 font-label text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted opacity-0"
              style={{ animation: "splash-fade-up 400ms ease-out 350ms forwards" }}
            >
              <ShieldIcon /> Enterprise Secured
            </span>
            <span
              className="text-[11px] text-text-muted/70 opacity-0"
              style={{ animation: "splash-fade-up 400ms ease-out 400ms forwards" }}
            >
              Autonomous Inventory &amp; Billing
            </span>
          </div>

          <style>{`
            @keyframes splash-pop {
              0% { opacity: 0; transform: scale(0.7); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes splash-fade-up {
              0% { opacity: 0; transform: translateY(6px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes splash-ring-pulse {
              0%, 100% { transform: scale(1); opacity: 0.6; }
              50% { transform: scale(1.08); opacity: 0.15; }
            }
            @keyframes splash-dot-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.3; transform: scale(0.7); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

function ShieldIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}
