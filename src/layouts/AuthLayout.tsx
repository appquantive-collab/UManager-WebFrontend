import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Boxes, ShieldCheck } from "lucide-react";
import { useMediaQuery } from "../lib/useMediaQuery";

const highlights = [
  { icon: Boxes, text: "Real-time inventory across every warehouse" },
  { icon: BarChart3, text: "Sales, purchases and reports in one place" },
  { icon: ShieldCheck, text: "Tenant isolation and audit logs by default" },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 64rem)");

  return isDesktop ? (
    <DesktopAuthLayout title={title} subtitle={subtitle}>
      {children}
    </DesktopAuthLayout>
  ) : (
    <MobileAuthLayout title={title} subtitle={subtitle}>
      {children}
    </MobileAuthLayout>
  );
}

function MobileAuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Link
        to="/"
        aria-label="Back to home"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <ArrowLeft size={17} />
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-elevation-2">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container">
              <img src="/logo-64.png" alt="UManager" className="h-8 w-8 object-contain" />
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-text">{title}</h1>
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DesktopAuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <div className="flex w-130 shrink-0 flex-col overflow-y-auto px-14 py-6">
        <Link
          to="/"
          className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-text-muted outline-none transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <div className="w-full max-w-sm">
            <div className="mb-5 flex flex-col items-center text-center">
              <img src="/logo-64.png" alt="UManager" className="h-9 w-9 object-contain" />
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-text">{title}</h1>
              <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden overflow-y-auto bg-primary">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 1px, transparent 1px, transparent 96px)",
            maskImage: "linear-gradient(to bottom, black, transparent 85%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-105 w-105 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.35), transparent)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-95 w-95 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.25), transparent)" }}
        />

        <div className="relative flex max-w-md flex-col px-12 py-10">
          <img src="/logo-192.png" alt="" className="h-14 w-14 object-contain" />
          <h2 className="mt-8 text-[32px] font-semibold leading-[1.15] tracking-tight text-on-primary">
            Run your business from one intelligent workspace
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-on-primary/80">
            Stock, sales, purchases and customers — all connected, always current, built for teams that move fast.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {highlights.map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-on-primary">
                  <item.icon size={17} strokeWidth={1.9} />
                </span>
                <span className="text-sm font-medium text-on-primary/90">{item.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-primary/70">
                Today&apos;s sales
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-on-primary">
                +12%
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-on-primary">₹4,82,500</div>
            <div className="mt-4 flex h-12 items-end gap-1.5">
              {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
                <span key={i} className="flex-1 rounded-t-md bg-white/25" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
