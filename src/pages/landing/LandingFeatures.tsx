import {
  BarChart3,
  Boxes,
  Mic,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
  Warehouse,
} from "lucide-react";

const features = [
  {
    icon: Boxes,
    title: "Real-time inventory",
    description: "Track stock across every warehouse with a full movement ledger — never lose an audit trail again.",
  },
  {
    icon: ShoppingCart,
    title: "Sales & purchases",
    description: "Quotations, orders, invoices, and supplier POs in one flow, from draft to payment.",
  },
  {
    icon: Users,
    title: "Customers & suppliers",
    description: "Credit limits, ledgers, and payment history for every party you do business with.",
  },
  {
    icon: Sparkles,
    title: "AI business assistant",
    description: "Ask in plain language — \"Aaj kitni sale hui?\" — and get answers grounded in your real data.",
  },
  {
    icon: Mic,
    title: "Voice & OCR entry",
    description: "Speak a sale or scan a paper invoice; review the draft before anything touches your books.",
  },
  {
    icon: Warehouse,
    title: "Multi-warehouse",
    description: "Independent stock per location, with transfers and approvals built in.",
  },
  {
    icon: BarChart3,
    title: "Reports that matter",
    description: "Sales, inventory valuation, receivables, and profit — always current, never stale spreadsheets.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant isolation & audit logs",
    description: "Every action is scoped, permissioned, and logged — built for teams, not just individuals.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="mx-auto max-w-290 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Features</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          Everything your business needs, in one place
        </h2>
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          Replace paper registers, spreadsheets, and WhatsApp order-taking with a single connected system.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-3xl border border-border bg-surface p-6 shadow-elevation-1 transition-all hover:-translate-y-1 hover:shadow-elevation-2"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-container text-primary">
              <feature.icon size={20} strokeWidth={1.9} />
            </span>
            <h3 className="mt-4 text-[15px] font-semibold text-text">{feature.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
