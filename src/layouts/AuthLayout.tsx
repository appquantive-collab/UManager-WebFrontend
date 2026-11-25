import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, AudioLines, Package, ReceiptText, Sparkles } from "lucide-react";
import { useMediaQuery } from "../lib/useMediaQuery";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

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
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-auth-gradient px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <AuthGlow />
      <div className="relative flex items-center justify-between">
        <Link
          to="/"
          aria-label={t("auth.layout.backToHome")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft size={17} />
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center py-6">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-col items-center text-center">
            <BrandBadge size={56} label={t("brand.name")} />
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
  const { t } = useTranslation();
  // Larger text on big screens (see .auth-root in index.css).
  useEffect(() => {
    document.documentElement.classList.add("auth-root");
    return () => document.documentElement.classList.remove("auth-root");
  }, []);

  const highlights = [
    { icon: Package, text: t("auth.layout.highlightStock") },
    { icon: ReceiptText, text: t("auth.layout.highlightBilling") },
    { icon: Sparkles, text: t("auth.layout.highlightAi") },
  ];

  return (
    <div className="flex h-screen bg-background">
      <div className="relative flex w-130 shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-auth-gradient px-14 py-6">
        <AuthGlow />
        <div className="relative flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-text-muted outline-none transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft size={16} />
            {t("auth.layout.backToHome")}
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center py-4">
          <div className="w-full max-w-md">
            <div className="mb-5 flex flex-col items-center text-center">
              <BrandBadge size={56} label={t("brand.name")} />
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-text">{title}</h1>
              <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <img
          src="/splash-munshi.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_15%]"
        />
        <div className="absolute inset-0 bg-linear-to-t from-primary-hover via-primary-hover/70 to-primary-hover/0" />

        <div className="relative mt-auto flex max-w-lg flex-col px-12 pb-12">
          <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide text-on-primary backdrop-blur-sm">
            {t("brand.name")} · {t("brand.assistantName")}
          </span>
          <h2 className="mt-4 text-[2rem] font-bold leading-[1.15] tracking-tight text-on-primary">
            {t("auth.layout.panelHeading")}
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-on-primary/85">{t("auth.layout.panelDescription")}</p>

          <div className="mt-7 flex flex-col gap-3.5">
            {highlights.map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-on-primary backdrop-blur-sm">
                  <item.icon size={17} strokeWidth={1.9} />
                </span>
                <span className="text-sm font-medium text-on-primary/95">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The VoiceMunshi voice badge (same as the app header), bigger. */
function BrandBadge({ size, label }: { size: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="flex items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-brand" style={{ width: size, height: size }}>
      <AudioLines size={Math.round(size * 0.5)} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

/** Soft orange glows behind the sign-in card (the brand's warm background). */
function AuthGlow() {
  return (
    // Clipped in their own layer, so they never add scroll space to the page.
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ffb98a]/40 blur-3xl" />
      <span className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-[#ffd2b0]/50 blur-3xl" />
    </span>
  );
}
