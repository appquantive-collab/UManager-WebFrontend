import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AudioLines, BookOpen, Check, ChevronLeft, ChevronRight, Mic, Package, ReceiptText, ShoppingCart, TrendingUp, Wallet, X } from "lucide-react";
import clsx from "clsx";

const TOUR_KEY = "voicemunshi.feature-tour.v1";

/** Shown once per login on this device. */
export function tourSeen(userId: string | undefined): boolean {
  try {
    return localStorage.getItem(`${TOUR_KEY}.${userId ?? "anon"}`) === "done";
  } catch {
    return true;
  }
}
function markTourSeen(userId: string | undefined) {
  try {
    localStorage.setItem(`${TOUR_KEY}.${userId ?? "anon"}`, "done");
  } catch {
    // Private mode: it may show again next visit; harmless.
  }
}

type Slide = { key: string; icon: typeof Mic; user?: string; reply: string; card?: ReactNode };

/**
 * What Munshi can do, one feature at a time, each with a little example chat
 * (what you say → what Munshi does). Next / Back / Skip; the last step opens Munshi.
 */
export function FeatureTour({ userId, onClose }: { userId: string | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  const card = (rows: ReactNode, icon: typeof Mic, title: string) => {
    const Icon = icon;
    return (
      <div className="mt-2 rounded-xl border border-border bg-surface p-2.5 text-left">
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
          <Icon size={12} className="text-primary" aria-hidden="true" />
          {title}
        </p>
        <div className="mt-1.5 space-y-1 text-[0.8125rem] text-text">{rows}</div>
      </div>
    );
  };
  const done = (text: string) => (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
      <Check size={13} strokeWidth={3} aria-hidden="true" />
      {text}
    </p>
  );

  const slides: Slide[] = [
    { key: "welcome", icon: AudioLines, reply: t("tour.welcome.reply") },
    {
      key: "bill",
      icon: ReceiptText,
      user: t("tour.bill.user"),
      reply: t("tour.bill.reply"),
      card: card(
        <>
          <p className="font-semibold">{t("tour.bill.line")}</p>
          {done(t("tour.bill.done"))}
        </>,
        ReceiptText,
        t("tour.cardTitle")
      ),
    },
    {
      key: "purchase",
      icon: ShoppingCart,
      user: t("tour.purchase.user"),
      reply: t("tour.purchase.reply"),
      card: card(
        <>
          <p className="font-semibold">{t("tour.purchase.line")}</p>
          {done(t("tour.purchase.done"))}
        </>,
        ShoppingCart,
        t("tour.cardTitle")
      ),
    },
    { key: "dues", icon: Wallet, user: t("tour.dues.user"), reply: t("tour.dues.reply") },
    { key: "stock", icon: Package, user: t("tour.stock.user"), reply: t("tour.stock.reply") },
    { key: "today", icon: TrendingUp, user: t("tour.today.user"), reply: t("tour.today.reply") },
    {
      key: "catalogue",
      icon: BookOpen,
      user: t("tour.catalogue.user"),
      reply: t("tour.catalogue.reply"),
      card: card(<p className="font-semibold text-primary">voicemunshi.app/c/…</p>, BookOpen, t("tour.catalogue.cardTitle")),
    },
  ];
  const slide = slides[index];
  const last = index === slides.length - 1;

  const finish = (openMunshi: boolean) => {
    markTourSeen(userId);
    onClose();
    if (openMunshi) navigate("/app/ai");
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-text/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="relative flex max-h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface shadow-elevation-3 sm:rounded-3xl">
        <button
          type="button"
          onClick={() => finish(false)}
          aria-label={t("tour.skip")}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-icon outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Example chat in a little phone */}
        <div className="bg-[linear-gradient(140deg,#fff7f1_0%,#ffe6d5_100%)] px-6 pb-6 pt-8">
          <div className="mx-auto w-full max-w-[17.5rem] rounded-[1.75rem] border-[6px] border-text/85 bg-surface-muted shadow-elevation-3">
            <div className="flex items-center gap-2 rounded-t-[1.3rem] bg-surface px-3 py-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-white">
                <AudioLines size={14} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="text-xs font-bold text-text">{t("brand.assistantName")}</span>
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            </div>
            <div key={slide.key} className="min-h-[13.5rem] space-y-2 p-3 motion-safe:animate-[sheet-up_300ms_ease-out]">
              {slide.user ? (
                <div className="flex justify-end">
                  <p className="flex max-w-[85%] items-start gap-1.5 rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[0.8125rem] leading-snug text-white">
                    <Mic size={13} className="mt-0.5 shrink-0 opacity-80" aria-hidden="true" />
                    {slide.user}
                  </p>
                </div>
              ) : null}
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-surface px-3 py-2 text-[0.8125rem] leading-snug text-text">
                  {slide.reply}
                  {slide.card}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Text + controls */}
        <div className="flex flex-1 flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <slide.icon size={14} aria-hidden="true" />
            {t("tour.step", { n: index + 1, total: slides.length })}
          </p>
          <h2 id="tour-title" className="mt-1.5 text-xl font-bold tracking-tight text-text">
            {t(`tour.${slide.key}.title`)}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">{t(`tour.${slide.key}.body`)}</p>

          <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
            {slides.map((s, i) => (
              <span key={s.key} className={clsx("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-1.5 bg-surface-variant")} />
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="flex h-12 items-center gap-1 rounded-xl border border-border px-4 text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                {t("tour.back")}
              </button>
            ) : (
              <button type="button" onClick={() => finish(false)} className="h-12 px-2 text-sm font-semibold text-text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40">
                {t("tour.skip")}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish(true) : setIndex(index + 1))}
              className="ml-auto flex h-12 items-center gap-1.5 rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-brand outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {last ? (
                <>
                  <Mic size={16} aria-hidden="true" />
                  {t("tour.start")}
                </>
              ) : (
                <>
                  {t("tour.next")}
                  <ChevronRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
