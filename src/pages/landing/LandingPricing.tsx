import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "For a single business getting off spreadsheets.",
    features: ["1 business", "2 users", "1 warehouse", "Sales & customers", "Basic reports"],
    highlighted: false,
  },
  {
    name: "Business",
    price: "Contact us",
    description: "For growing wholesalers with multiple staff.",
    features: [
      "Multiple users & warehouses",
      "Purchases & suppliers",
      "AI assistant & automations",
      "Advanced reports",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Contact us",
    description: "For established distributors at scale.",
    features: [
      "Unlimited users",
      "Advanced permissions",
      "API & integrations",
      "Priority support",
    ],
    highlighted: false,
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="mx-auto max-w-290 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Pricing</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          Plans that grow with your business
        </h2>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={
              plan.highlighted
                ? "relative rounded-3xl border-2 border-primary bg-surface p-7 shadow-elevation-3"
                : "relative rounded-3xl border border-border bg-surface p-7 shadow-elevation-1"
            }
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-text">{plan.name}</h3>
            <p className="mt-1 text-sm text-text-muted">{plan.description}</p>
            <div className="mt-5 text-3xl font-bold text-text">{plan.price}</div>
            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-text-muted">
                  <Check size={16} className="mt-0.5 shrink-0 text-success" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className={
                plan.highlighted
                  ? "mt-7 flex h-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary shadow-elevation-1 transition-colors hover:bg-primary-hover"
                  : "mt-7 flex h-11 items-center justify-center rounded-full border border-border text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
              }
            >
              Get Started
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
