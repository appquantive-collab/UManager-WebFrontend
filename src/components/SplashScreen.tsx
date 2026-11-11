import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, LogIn, Package, ReceiptText, Sparkles, Store } from "lucide-react";
import { useAuthStore } from "../lib/auth-store";
import { useSplashStore } from "../lib/splash-store";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { router } from "../routes/router";

// A soft halo in the page colour keeps headings readable where they overlap the photo on phones.
const TEXT_HALO = "[text-shadow:0_0_14px_var(--color-background),0_0_4px_var(--color-background)] lg:[text-shadow:none]";

const BRIEF_VISIBLE_MS = 2200;
const FADE_MS = 400;

// Signed-out visitors on any pre-login page get an interactive welcome that
// stays until they choose: "Get started" opens the Munshi AI chat, "Login" is
// for existing users. Signed-in users and app pages get a brief splash.
const PRE_LOGIN_PATHS = ["/", "/welcome", "/login", "/register", "/forgot-password"];
const CHAT_PATHS = ["/", "/welcome"];

function currentPath(): string {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

function shouldWelcome(): boolean {
  return !useAuthStore.getState().accessToken && PRE_LOGIN_PATHS.includes(currentPath());
}

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const isSignedIn = useAuthStore((state) => Boolean(state.user));
  const finishSplash = useSplashStore((state) => state.finish);
  const requestChat = useSplashStore((state) => state.requestChat);
  const [mode] = useState<"welcome" | "brief">(() => (shouldWelcome() ? "welcome" : "brief"));
  const [phase, setPhase] = useState<"show" | "fade" | "hidden">("show");

  useEffect(() => {
    if (mode !== "brief" || phase !== "show") return;
    const timer = setTimeout(() => setPhase("fade"), BRIEF_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [mode, phase]);

  useEffect(() => {
    if (phase !== "fade") return;
    const timer = setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "hidden") finishSplash();
  }, [phase, finishSplash]);

  const start = () => {
    requestChat();
    // "/" shows the chat over the landing page on desktop and redirects to /welcome on phones.
    if (!CHAT_PATHS.includes(currentPath())) void router.navigate("/");
    setPhase("fade");
  };

  const goToLogin = () => {
    if (currentPath() !== "/login") void router.navigate("/login");
    setPhase("fade");
  };

  const features = [
    { icon: Sparkles, label: t("splash.featureAi") },
    { icon: ReceiptText, label: t("splash.featureBilling") },
    { icon: Package, label: t("splash.featureStock") },
  ];

  const isWelcome = mode === "welcome";

  return (
    <>
      {children}
      {phase !== "hidden" && (
        <div
          className="fixed inset-0 z-100 overflow-hidden bg-background transition-opacity"
          style={{ opacity: phase === "fade" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
          {...(isWelcome
            ? { role: "dialog", "aria-modal": true, "aria-label": t("brand.name") }
            : { "aria-hidden": true })}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-linear-to-r from-primary-hover via-warning to-primary-hover" />

          {/* Photo: top of the screen on phones, left half on desktop. */}
          <div className="absolute inset-x-0 top-0 h-[60%] lg:inset-y-0 lg:right-auto lg:h-full lg:w-1/2">
            <img
              src="/splash-munshi.webp"
              alt={t("splash.photoAlt")}
              className="h-full w-full object-cover object-[center_18%]"
              style={{ animation: "splash-photo-in 1400ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
            />
            {/* Phones: the text sits over the lower photo, so fade to the background early (longer
                Hindi text reaches higher). Desktop: text is beside the photo, a side fade is enough. */}
            <div className="absolute inset-0 bg-linear-to-b from-background/0 from-25% via-background/75 via-60% to-background to-85% lg:hidden" />
            <div className="absolute inset-0 hidden bg-linear-to-r from-background/0 via-background/0 to-background lg:block" />
          </div>

          <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-[max(0.85rem,env(safe-area-inset-top))]">
            <span className="flex items-center gap-2 rounded-full border border-border bg-surface/85 py-1 pl-1 pr-3 shadow-elevation-1 backdrop-blur-md">
              <img src="/logo.svg" alt="" className="h-6 w-6 rounded-full" />
              <span className="text-xs font-bold tracking-wide text-primary">{t("brand.assistantName")}</span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            </span>
            {isWelcome && !isSignedIn ? <LanguageSwitcher /> : null}
          </header>

          <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] lg:inset-y-0 lg:left-1/2 lg:items-center lg:pb-0">
            <div className="flex w-full max-w-md flex-col items-center text-center">
              <h1
                className={`${TEXT_HALO} text-[1.625rem] font-extrabold leading-8.5 tracking-tight text-primary-hover opacity-0 lg:text-[2.5rem] lg:leading-12`}
                style={{ animation: "splash-fade-up 500ms ease-out 250ms forwards" }}
              >
                {t("brand.name")}
              </h1>
              <p
                className={`${TEXT_HALO} mt-1 text-lg font-semibold leading-6.5 text-text-subtle opacity-0 lg:text-xl`}
                style={{ animation: "splash-fade-up 500ms ease-out 350ms forwards" }}
              >
                {t("splash.greeting")}
              </p>
              <p
                className={`${TEXT_HALO} mt-1 text-xs font-medium leading-4.5 text-secondary opacity-0 lg:text-sm lg:font-normal`}
                style={{ animation: "splash-fade-up 500ms ease-out 420ms forwards" }}
              >
                {t("splash.tagline")}
              </p>

              <div
                className="mt-6 grid w-full grid-cols-3 gap-2.5 opacity-0"
                style={{ animation: "splash-fade-up 500ms ease-out 520ms forwards" }}
              >
                {features.map((feature) => (
                  <div
                    key={feature.label}
                    className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface/90 p-3 shadow-elevation-1 backdrop-blur-md"
                  >
                    <feature.icon size={20} strokeWidth={1.75} className="mb-1.5 text-icon" aria-hidden="true" />
                    <span className="text-xs font-bold leading-tight text-text">{feature.label}</span>
                  </div>
                ))}
              </div>

              {isWelcome ? (
                <button
                  type="button"
                  onClick={start}
                  autoFocus
                  className="group mt-7 flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-4 text-sm font-bold tracking-wide text-on-primary opacity-0 shadow-elevation-3 outline-none transition-[transform,background-color] hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.98]"
                  style={{ animation: "splash-fade-up 500ms ease-out 620ms forwards" }}
                >
                  {t("splash.start")}
                  <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
                </button>
              ) : null}
              {isWelcome ? (
                <button
                  type="button"
                  onClick={goToLogin}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/90 px-6 py-3.5 text-sm font-bold tracking-wide text-text opacity-0 shadow-elevation-1 outline-none backdrop-blur-md transition-[transform,border-color,color] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.98]"
                  style={{ animation: "splash-fade-up 500ms ease-out 680ms forwards" }}
                >
                  <LogIn size={17} />
                  {t("splash.login")}
                </button>
              ) : (
                <span className="mt-7 flex h-14 items-center justify-center gap-1.5" role="status">
                  <span className="sr-only">{t("splash.loading")}</span>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full bg-primary"
                      style={{ animation: `splash-dot-pulse 1100ms ease-in-out ${i * 160}ms infinite` }}
                    />
                  ))}
                </span>
              )}

              <span
                className="mt-4 flex items-center gap-1.5 text-xs font-medium text-text-subtle opacity-0"
                style={{ animation: "splash-fade-up 500ms ease-out 700ms forwards" }}
              >
                <Store size={13} className="text-icon" aria-hidden="true" />
                {t("splash.madeFor")}
              </span>
            </div>
          </div>

          <style>{`
            @keyframes splash-photo-in {
              0% { opacity: 0; transform: scale(1.06); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes splash-fade-up {
              0% { opacity: 0; transform: translateY(8px); }
              100% { opacity: 1; transform: translateY(0); }
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
