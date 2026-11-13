import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowUp,
  Building2,
  ClipboardList,
  Clock,
  Package,
  ReceiptText,
  Search,
  Sparkles,
  Truck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { FilterChips } from "../../components/page/kit";
import { formatCurrency } from "../../lib/format";
import { listCustomers } from "../../lib/customers-api";
import { listSuppliers } from "../../lib/suppliers-api";
import { listProducts } from "../../lib/products-api";
import { listOrders } from "../../lib/orders-api";
import { listInvoices } from "../../lib/invoices-api";
import { SerialLookupCard } from "../../components/inventory/SerialLookupCard";
import { listPurchases, supplierOf } from "../../lib/purchases-api";
import { listStaff } from "../../lib/staff-api";
import { askBusinessQuestion } from "../../lib/ai-chat-api";
import { ApiError } from "../../lib/api";
import { errorMessage } from "../../lib/api-errors";

// One place to find anything (Normal search) or ask about the business in
// plain words (AI search). Normal results open the right page already filtered
// to that item; AI answers come from Munshi AI using the business's own data.

type Mode = "normal" | "ai";
type Kind = "customers" | "suppliers" | "products" | "bills" | "orders" | "purchases" | "staff";

interface Result {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  meta?: string;
  metaTone?: "danger" | "muted";
  to: string;
  haystack: string;
}

const KIND_ICONS: Record<Kind, LucideIcon> = {
  customers: Users,
  suppliers: Building2,
  products: Package,
  bills: ReceiptText,
  orders: ClipboardList,
  purchases: Truck,
  staff: UserRound,
};
const KIND_ORDER: Kind[] = ["customers", "products", "bills", "orders", "suppliers", "purchases", "staff"];
const PER_GROUP = 5;

const RECENT_KEY = "sethsathi.recent-searches";
function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}
function saveRecent(query: string) {
  const q = query.trim();
  if (q.length < 2) return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6)));
  } catch {
    // Recent searches are a convenience; skip when storage isn't available.
  }
}

const q = (value: string) => encodeURIComponent(value);

/** Bold the parts of `text` that match the search words. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>;
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        tokens.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-transparent font-bold text-text">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("mode") === "ai" ? "ai" : "normal";
  const [text, setText] = useState(params.get("q") ?? "");
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [recent, setRecent] = useState(readRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const setMode = (next: Mode) => {
    setParams((current) => {
      const nextParams = new URLSearchParams(current);
      nextParams.set("mode", next);
      return nextParams;
    }, { replace: true });
  };

  // Keep the query in the address so Back returns to the same results.
  useEffect(() => {
    if (mode !== "normal") return;
    const handle = window.setTimeout(() => {
      setParams((current) => {
        const nextParams = new URLSearchParams(current);
        if (text.trim()) nextParams.set("q", text.trim());
        else nextParams.delete("q");
        return nextParams;
      }, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [text, mode, setParams]);

  // ---------- Normal search ----------
  const enabled = mode === "normal";
  const customers = useQuery({ queryKey: ["customers", "all"], queryFn: () => listCustomers(), enabled });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers(), enabled });
  const products = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), enabled });
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => listOrders(), enabled });
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: listInvoices, enabled });
  const purchases = useQuery({ queryKey: ["purchases"], queryFn: listPurchases, enabled });
  const staff = useQuery({ queryKey: ["staff"], queryFn: listStaff, enabled });
  const loading = [customers, suppliers, products, orders, invoices, purchases, staff].some((query) => query.isLoading);

  const index = useMemo<Result[]>(() => {
    const out: Result[] = [];
    for (const c of customers.data ?? [])
      out.push({
        id: c._id,
        kind: "customers",
        title: c.name,
        subtitle: c.phone,
        meta: c.outstanding > 0 ? t("search.owes", { amount: formatCurrency(c.outstanding) }) : undefined,
        metaTone: "danger",
        to: `/app/customers?q=${q(c.name)}`,
        haystack: `${c.name} ${c.phone ?? ""}`,
      });
    for (const p of products.data ?? [])
      out.push({
        id: p._id,
        kind: "products",
        title: p.name,
        subtitle: [p.sku, p.category].filter(Boolean).join(" · "),
        meta: formatCurrency(p.wholesalePrice),
        metaTone: "muted",
        to: `/app/inventory?q=${q(p.name)}`,
        haystack: `${p.name} ${p.sku} ${p.barcode ?? ""} ${p.category ?? ""} ${p.brand ?? ""}`,
      });
    for (const i of invoices.data ?? []) {
      const customer = typeof i.customerId === "string" ? { name: "", phone: "" } : i.customerId;
      const due = Math.max(0, i.totalAmount - i.amountPaid);
      out.push({
        id: i._id,
        kind: "bills",
        title: `${i.invoiceNumber} · ${customer.name}`,
        subtitle: new Date(i.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        meta: due > 0 ? t("search.due", { amount: formatCurrency(due) }) : formatCurrency(i.totalAmount),
        metaTone: due > 0 ? "danger" : "muted",
        to: `/app/sales?tab=bills&q=${q(i.invoiceNumber)}`,
        haystack: `${i.invoiceNumber} ${customer.name} ${customer.phone ?? ""} ${i.items.map((x) => `${x.productName} ${(x.serials ?? []).join(" ")}`).join(" ")}`,
      });
    }
    for (const o of orders.data ?? []) {
      const customer = typeof o.customerId === "string" ? { name: "", phone: "" } : o.customerId;
      out.push({
        id: o._id,
        kind: "orders",
        title: customer.name || t("search.order"),
        subtitle: o.items.map((x) => x.productName).join(", "),
        meta: formatCurrency(o.totalAmount),
        metaTone: "muted",
        to: `/app/sales?tab=orders&q=${q(customer.name)}`,
        haystack: `${customer.name} ${customer.phone ?? ""} ${o.items.map((x) => x.productName).join(" ")}`,
      });
    }
    for (const s of suppliers.data ?? [])
      out.push({
        id: s._id,
        kind: "suppliers",
        title: s.name,
        subtitle: [s.phone, s.gstin].filter(Boolean).join(" · "),
        meta: (s.outstanding ?? 0) > 0 ? t("search.youOwe", { amount: formatCurrency(s.outstanding ?? 0) }) : undefined,
        metaTone: "danger",
        to: `/app/suppliers?q=${q(s.name)}`,
        haystack: `${s.name} ${s.phone ?? ""} ${s.gstin ?? ""}`,
      });
    for (const p of purchases.data ?? []) {
      const supplier = supplierOf(p);
      out.push({
        id: p._id,
        kind: "purchases",
        title: `${p.purchaseNumber} · ${supplier.name}`,
        subtitle: p.items.map((x) => x.productName).join(", "),
        meta: formatCurrency(p.totalAmount),
        metaTone: "muted",
        to: `/app/purchases?q=${q(p.purchaseNumber)}`,
        haystack: `${p.purchaseNumber} ${p.supplierBillNumber ?? ""} ${supplier.name} ${supplier.phone ?? ""} ${p.items.map((x) => x.productName).join(" ")}`,
      });
    }
    for (const s of staff.data ?? [])
      out.push({
        id: s._id,
        kind: "staff",
        title: s.name,
        subtitle: s.phone,
        to: `/app/staff?q=${q(s.name)}`,
        haystack: `${s.name} ${s.phone ?? ""}`,
      });
    return out;
  }, [customers.data, products.data, invoices.data, orders.data, suppliers.data, purchases.data, staff.data, t]);

  const tokens = useMemo(() => text.trim().toLowerCase().split(/\s+/).filter(Boolean), [text]);
  const matches = useMemo(
    () => (tokens.length === 0 ? [] : index.filter((r) => tokens.every((token) => r.haystack.toLowerCase().includes(token)))),
    [index, tokens]
  );
  const counts = useMemo(() => {
    const map = new Map<Kind, number>();
    for (const r of matches) map.set(r.kind, (map.get(r.kind) ?? 0) + 1);
    return map;
  }, [matches]);

  const open = (result: Result) => {
    saveRecent(text);
    navigate(result.to);
  };

  // ---------- AI search ----------
  const [answers, setAnswers] = useState<{ id: number; question: string; answer?: string; error?: string }[]>([]);
  const ask = useMutation({ mutationFn: askBusinessQuestion });
  const askQuestion = (question: string) => {
    const clean = question.trim();
    if (!clean || ask.isPending) return;
    const id = Date.now();
    setAnswers((current) => [{ id, question: clean }, ...current]);
    setText("");
    ask.mutate(clean, {
      onSuccess: ({ answer }) => setAnswers((current) => current.map((a) => (a.id === id ? { ...a, answer: answer || t("search.ai.noAnswer") } : a))),
      onError: (err) =>
        setAnswers((current) =>
          current.map((a) => (a.id === id ? { ...a, error: err instanceof ApiError && err.code ? errorMessage(err, t) : err instanceof ApiError ? err.message : t("search.ai.failed") } : a))
        ),
    });
  };
  const suggestions = t("search.ai.suggestions", { returnObjects: true }) as unknown as string[];

  const submit = () => {
    if (mode === "ai") askQuestion(text);
    else saveRecent(text);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Mode switch */}
      <div role="tablist" aria-label={t("search.modeLabel")} className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-variant p-1">
        {(["normal", "ai"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
            className={clsx(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              mode === item ? "bg-surface text-text shadow-elevation-1" : "text-text-muted hover:text-text"
            )}
          >
            {item === "ai" ? <Sparkles size={17} className={mode === item ? "text-primary" : "text-icon"} aria-hidden="true" /> : <Search size={17} className="text-icon" aria-hidden="true" />}
            {t(`search.mode.${item}`)}
          </button>
        ))}
      </div>

      {/* Search box */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-elevation-1 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"
      >
        {mode === "ai" ? <Sparkles size={20} className="ml-2 shrink-0 text-icon" aria-hidden="true" /> : <Search size={20} className="ml-2 shrink-0 text-icon" aria-hidden="true" />}
        <input
          ref={inputRef}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={mode === "ai" ? t("search.ai.placeholder") : t("search.placeholder")}
          aria-label={mode === "ai" ? t("search.ai.placeholder") : t("search.placeholder")}
          enterKeyHint={mode === "ai" ? "send" : "search"}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {text ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              inputRef.current?.focus();
            }}
            aria-label={t("search.clear")}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-icon outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
        {mode === "ai" ? (
          <button
            type="submit"
            disabled={!text.trim() || ask.isPending}
            aria-label={t("search.ai.ask")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
          >
            <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {mode === "normal" ? <SerialLookupCard text={text} /> : null}
      {mode === "normal" ? (
        tokens.length === 0 ? (
          <div className="space-y-4">
            {recent.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-text">{t("search.recent")}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.removeItem(RECENT_KEY);
                      } catch {
                        // ignore
                      }
                      setRecent([]);
                    }}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {t("search.clearRecent")}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setText(item)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Clock size={14} className="text-icon" aria-hidden="true" />
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-text">{t("search.helpTitle")}</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                {KIND_ORDER.map((k) => {
                  const Icon = KIND_ICONS[k];
                  return (
                    <li key={k} className="flex items-center gap-2 text-sm text-text-muted">
                      <Icon size={16} className="shrink-0 text-icon" aria-hidden="true" />
                      {t(`search.kinds.${k}`)}
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => setMode("ai")}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Sparkles size={15} aria-hidden="true" />
                {t("search.tryAi")}
              </button>
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <FilterChips
              label={t("search.filterLabel")}
              value={kind}
              onChange={setKind}
              options={[
                { key: "all", label: t("search.all"), count: matches.length },
                ...KIND_ORDER.filter((k) => counts.get(k)).map((k) => ({ key: k, label: t(`search.kinds.${k}`), count: counts.get(k) })),
              ]}
            />

            {matches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
                <Search size={28} strokeWidth={1.5} className="mx-auto text-icon" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-text">{loading ? t("search.loading") : t("search.noResults", { query: text.trim() })}</p>
                {!loading ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("ai");
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <Sparkles size={15} aria-hidden="true" />
                    {t("search.askAiInstead")}
                  </button>
                ) : null}
              </div>
            ) : (
              KIND_ORDER.filter((k) => (kind === "all" || kind === k) && counts.get(k)).map((k) => {
                const group = matches.filter((r) => r.kind === k);
                const shown = kind === "all" ? group.slice(0, PER_GROUP) : group.slice(0, 50);
                return (
                  <ResultGroup
                    key={k}
                    title={t(`search.kinds.${k}`)}
                    count={group.length}
                    more={kind === "all" && group.length > PER_GROUP ? () => setKind(k) : undefined}
                    moreLabel={t("search.showAll", { count: group.length })}
                  >
                    {shown.map((result) => {
                      const Icon = KIND_ICONS[result.kind];
                      return (
                        <li key={`${result.kind}-${result.id}`}>
                          <button
                            type="button"
                            onClick={() => open(result)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
                          >
                            <Icon size={18} strokeWidth={1.75} className="shrink-0 text-icon" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-text">
                                <Highlight text={result.title} tokens={tokens} />
                              </span>
                              {result.subtitle ? (
                                <span className="block truncate text-xs text-text-muted">
                                  <Highlight text={result.subtitle} tokens={tokens} />
                                </span>
                              ) : null}
                            </span>
                            {result.meta ? (
                              <span
                                className={clsx(
                                  "shrink-0 text-sm font-semibold tabular-nums",
                                  result.metaTone === "danger" ? "text-danger" : "text-text-muted"
                                )}
                              >
                                {result.meta}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ResultGroup>
                );
              })
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {answers.length === 0 ? (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-text">{t("search.ai.intro")}</p>
              <p className="mt-1 text-sm text-text-muted">{t("search.ai.introHint")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Array.isArray(suggestions) ? suggestions : []).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => askQuestion(suggestion)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-sm text-text outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {answers.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1">
              <p className="border-b border-border bg-surface-muted px-4 py-2.5 text-sm font-semibold text-text">{item.question}</p>
              <div className="px-4 py-3">
                {item.answer ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{item.answer}</p>
                ) : item.error ? (
                  <p className="text-sm text-danger">{item.error}</p>
                ) : (
                  <div className="space-y-2" aria-busy="true" aria-label={t("search.ai.thinking")}>
                    <div className="h-3 w-4/5 animate-pulse rounded bg-surface-variant" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-surface-variant" />
                  </div>
                )}
              </div>
              {item.answer ? (
                <button
                  type="button"
                  onClick={() => navigate("/app/ai")}
                  className="flex w-full items-center justify-between border-t border-border px-4 py-2.5 text-sm font-semibold text-primary outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                >
                  {t("search.ai.continue")}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : null}
            </article>
          ))}

          <p className="text-center text-xs text-text-muted">{t("search.ai.note")}</p>
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title,
  count,
  more,
  moreLabel,
  children,
}: {
  title: string;
  count: number;
  more?: () => void;
  moreLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-bold text-text">{title}</h2>
        <span className="text-xs font-semibold tabular-nums text-text-muted">{count}</span>
      </div>
      <ul className="divide-y divide-border">{children}</ul>
      {more ? (
        <button
          type="button"
          onClick={more}
          className="w-full border-t border-border px-4 py-2.5 text-left text-sm font-semibold text-primary outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
        >
          {moreLabel}
        </button>
      ) : null}
    </section>
  );
}
