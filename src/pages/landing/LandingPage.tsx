import { Navigate } from "react-router-dom";
import { LandingNav } from "./LandingNav";
import { LandingHero } from "./LandingHero";
import { DashboardMockup } from "./DashboardMockup";
import { LandingFeatures } from "./LandingFeatures";
import { LandingPricing } from "./LandingPricing";
import { LandingFooter } from "./LandingFooter";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { useAuthStore } from "../../lib/auth-store";

export function LandingPage() {
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  const accessToken = useAuthStore((state) => state.accessToken);

  // Mobile/tablet has no marketing site — it boots straight into the app,
  // same as a real installed app never shows a landing page after launch.
  if (!isDesktop) {
    return <Navigate to={accessToken ? "/app" : "/login"} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <LandingHero />
      <DashboardMockup />
      <LandingFeatures />
      <LandingPricing />
      <LandingFooter />
    </div>
  );
}
