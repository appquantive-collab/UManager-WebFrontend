import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LandingNav } from "./LandingNav";
import { LandingHero } from "./LandingHero";
import { DashboardMockup } from "./DashboardMockup";
import { LandingFeatures } from "./LandingFeatures";
import { LandingPricing } from "./LandingPricing";
import { LandingFooter } from "./LandingFooter";
import { MunshiWelcomeChat } from "../../components/welcome/MunshiWelcomeChat";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { useAuthStore } from "../../lib/auth-store";
import { useSplashStore } from "../../lib/splash-store";

export function LandingPage() {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  const accessToken = useAuthStore((state) => state.accessToken);
  const splashDone = useSplashStore((state) => state.done);
  // Read once: signing up inside the chat creates a session, and the chat has
  // to stay open for its congratulations instead of vanishing mid-message.
  const [signedInOnArrival] = useState(() => Boolean(useAuthStore.getState().accessToken));
  const chatRequested = useSplashStore((state) => state.chatRequested);

  // Mobile/tablet has no marketing site — it boots straight into the app,
  // same as a real installed app never shows a landing page after launch.
  if (!isDesktop) {
    return <Navigate to={accessToken ? "/app" : "/welcome"} replace />;
  }

  // Closing the Munshi AI chat means "not now" — existing users go to log in.
  const closeChat = () => navigate("/login");

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <LandingHero />
      <DashboardMockup />
      <LandingFeatures />
      <LandingPricing />
      <LandingFooter />

      {chatRequested && splashDone && !signedInOnArrival ? (
        <div className="fixed inset-0 z-90 flex items-center justify-center bg-text/40 p-6 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            className="flex h-[min(760px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border shadow-elevation-3"
          >
            <MunshiWelcomeChat onClose={closeChat} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
