import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle, Warehouse } from "lucide-react";

export function LandingHero() {
  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-24 sm:pt-32">
      {/* Subtle vertical grid lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent 96px)",
          maskImage: "linear-gradient(to bottom, black, transparent 85%)",
        }}
      />
      {/* Radial glow behind the heading */}
      <div
        className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--color-primary-container), transparent)" }}
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 text-center">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-muted shadow-elevation-1">
          Built for wholesalers, retailers and growing businesses.
        </span>

        <h1 className="text-[40px] font-semibold leading-[1.08] tracking-tight text-text sm:text-[56px] md:text-[64px] lg:text-[72px]">
          <span className="inline-flex items-center gap-3 sm:gap-4">
            Smart
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-elevation-2 sm:h-12 sm:w-12 md:h-14 md:w-14">
              <Warehouse size={24} className="sm:size-7 md:size-8" strokeWidth={2} />
            </span>
            Inventory
          </span>
          <span className="mt-1 block text-primary sm:mt-2">Management, Simplified</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[680px] text-[17px] leading-[1.6] text-text-muted sm:text-lg">
          Manage stock, purchases, sales, customers, suppliers, payments, and business operations from one
          intelligent platform.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="group flex h-[54px] items-center gap-2 rounded-full bg-primary px-7 text-[15px] font-semibold text-on-primary shadow-elevation-2 outline-none transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-elevation-3 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Get Started
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#demo"
            className="flex h-[54px] items-center gap-2 rounded-full border border-border bg-surface px-7 text-[15px] font-semibold text-text shadow-elevation-1 outline-none transition-all hover:-translate-y-0.5 hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <PlayCircle size={18} />
            Request Demo
          </a>
        </div>
      </div>
    </section>
  );
}
