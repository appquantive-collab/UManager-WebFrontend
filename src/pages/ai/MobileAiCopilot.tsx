import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CloudCog,
  Languages,
  Mic,
  MicOff,
  Package,
  RefreshCw,
  Sparkles,
  Store,
  TrendingUp,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { formatCurrency } from "../../lib/format";

const lineItems = [
  { name: "Coca-Cola 300ml (24x)", detail: "20 Cartons × ₹145", amount: 2900 },
  { name: "Pepsi 500ml (24x)", detail: "10 Cartons × ₹160", amount: 1600 },
];

const promptChips = [
  { icon: TrendingUp, text: "Aaj kitni sale hui?" },
  { icon: Wallet, text: "Kaunse customer ka payment pending hai?" },
  { icon: Package, text: "Product A ka stock kitne din chalega?" },
  { icon: RefreshCw, text: "Kal mujhe kya purchase karna chahiye?" },
];

type DraftState = "pending" | "confirmed" | "discarded";

export function MobileAiCopilot() {
  const [transcript, setTranscript] = useState(
    "Sharma Traders ko 20 carton Coke aur 10 carton Pepsi credit pe diya."
  );
  const [listening, setListening] = useState(true);
  const [draftState, setDraftState] = useState<DraftState>("pending");

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-elevation-1">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles size={20} className="shrink-0 text-primary" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-headline text-sm font-semibold text-text">AI Business Copilot</span>
            <span className="flex items-center gap-1.5 font-label text-[11px] text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Connected to DB • Read/Draft Mode
            </span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary-container px-2.5 py-1 font-label text-[11px] font-medium text-on-secondary-container">
          <Languages size={14} />
          HIN / ENG
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-secondary-container bg-gradient-to-b from-secondary-container/40 via-primary-container/20 to-surface p-4 text-center shadow-elevation-1">
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-secondary-container/40 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-primary-container/30 blur-2xl" />

        <div className="relative my-1 flex items-center justify-center">
          <span className="absolute h-24 w-24 rounded-full bg-secondary-container/30 animate-ping" />
          <span className="absolute h-28 w-28 rounded-full bg-secondary-container/20" />
          <button
            type="button"
            onClick={() => setListening((v) => !v)}
            aria-label="Toggle AI voice recognition"
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-elevation-2 outline-none transition-all hover:bg-primary-hover active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {listening ? <Mic size={30} /> : <MicOff size={30} />}
          </button>
        </div>

        <div className="relative z-10 mt-1 flex flex-col items-center gap-1.5">
          <span className="flex items-center gap-1.5 font-label text-[11px] font-semibold text-primary">
            {listening ? "Listening in Hindi / Hinglish / English..." : "Voice input paused"}
          </span>

          {listening && (
            <div className="my-1 flex h-5 items-center gap-1.5">
              {[8, 16, 20, 12, 20, 12, 8].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-primary"
                  style={{ height: h, animation: `pulse ${0.6 + i * 0.1}s ease-in-out infinite` }}
                />
              ))}
            </div>
          )}

          <div className="w-full rounded-xl border border-border bg-surface p-3 text-left shadow-elevation-1">
            <div className="flex items-start gap-2">
              <Mic size={16} className="mt-0.5 shrink-0 text-secondary" />
              <p className="text-sm font-medium text-text">&ldquo;{transcript}&rdquo;</p>
            </div>
          </div>
        </div>
      </div>

      {draftState !== "discarded" && (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-elevation-2">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-info" />

          {draftState === "pending" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={16} className="text-primary" />
                  <span className="font-label text-xs font-bold tracking-wide text-primary">#DRAFT-904</span>
                </div>
                <span className="rounded-full bg-secondary-container px-2.5 py-0.5 font-label text-[11px] font-medium text-on-secondary-container">
                  Auto-Parsed Intent
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-muted p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-primary">
                    <Store size={18} />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-text">Sharma Traders</span>
                    <span className="flex items-center gap-1 font-label text-[11px] text-text-muted">
                      <span className="font-semibold text-primary">Available Credit:</span> {formatCurrency(142000)}
                    </span>
                  </div>
                </div>
                <CheckCircle2 size={20} className="shrink-0 text-success" />
              </div>

              <div className="space-y-1.5 rounded-xl border border-border bg-surface-muted/70 p-3">
                <span className="font-label text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Line Items Extracted
                </span>
                {lineItems.map((item, i) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between py-1">
                      <div className="min-w-0 pr-2">
                        <span className="block truncate text-xs font-semibold text-text">{item.name}</span>
                        <span className="font-label text-[11px] text-text-muted">{item.detail}</span>
                      </div>
                      <span className="shrink-0 font-label text-[13px] font-bold text-text">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    {i < lineItems.length - 1 && <div className="h-px w-full bg-border" />}
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between rounded-lg border border-border bg-surface p-2">
                  <span className="flex items-center gap-1 font-label text-[11px] font-medium text-text-muted">
                    <CheckCircle2 size={13} className="text-success" /> Credit Terms: 15 Days
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-label text-[11px] text-text-muted">Total:</span>
                    <span className="font-label text-[13px] font-bold text-text">{formatCurrency(total)}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDraftState("discarded")}
                  className="col-span-2 flex h-12 items-center justify-center gap-1 rounded-xl border border-border bg-surface text-sm font-semibold text-text outline-none transition-all hover:bg-surface-muted active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <X size={18} /> Discard
                </button>
                <button
                  type="button"
                  onClick={() => setDraftState("confirmed")}
                  className="col-span-3 flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-on-primary shadow-elevation-2 outline-none transition-all hover:bg-primary-hover active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <CheckCircle2 size={18} /> Confirm Order
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2 py-6 text-center">
              <CheckCircle2 size={36} className="text-success" />
              <span className="font-headline text-base font-semibold text-text">Order #SO-4091 Created!</span>
              <span className="text-sm text-text-muted">Saved to Sharma Traders ledger &amp; inventory deducted.</span>
            </div>
          )}
        </div>
      )}

      {draftState === "discarded" && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3 shadow-elevation-1">
          <span className="text-sm text-text-muted">Draft #DRAFT-904 discarded.</span>
          <button
            type="button"
            onClick={() => setDraftState("pending")}
            className="flex items-center gap-1 font-label text-xs font-semibold text-primary underline outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-primary">
          <TrendingUp size={22} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="font-label text-[11px] font-bold uppercase tracking-wide text-primary">
              Smart Reorder Alert
            </span>
            <span className="rounded-md border border-danger-container bg-danger-container px-1.5 py-0.5 font-label text-[11px] font-semibold text-danger">
              2 Days Left
            </span>
          </div>
          <p className="text-sm leading-snug text-text-muted">
            Mustard Oil is running out in 2 days. 3 local suppliers found with best rate{" "}
            <strong className="font-label font-bold text-primary">₹1,520</strong> (Save ₹30/box).
          </p>
          <button className="flex items-center gap-0.5 pt-0.5 font-label text-[11px] font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
            Compare 3 Vendors <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-label text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Tap to Ask AI
          </span>
          <span className="font-label text-[11px] font-semibold text-primary">Audio Shortcuts</span>
        </div>
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {promptChips.map((chip) => (
            <button
              key={chip.text}
              type="button"
              onClick={() => setTranscript(chip.text)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-left shadow-elevation-1 outline-none transition-all hover:bg-surface-muted active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <chip.icon size={16} className="text-primary" />
              <span className="truncate text-sm font-medium text-text">&ldquo;{chip.text}&rdquo;</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 shadow-elevation-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-primary">
            <CloudCog size={18} />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text">Auto-Syncing Ledger</span>
            <span className="font-label text-[11px] text-text-muted">Last entry converted 4m ago</span>
          </div>
        </div>
        <span className="rounded-md border border-secondary-container bg-secondary-container/50 px-2 py-1 font-label text-[11px] font-semibold text-primary">
          Live Tally Bridge
        </span>
      </div>
    </div>
  );
}
