import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../lib/auth-store";
import { MunshiWelcomeChat } from "../../components/welcome/MunshiWelcomeChat";

export function WelcomePage() {
  // Checked once on arrival only: signing up inside the chat creates a session,
  // and the chat must stay on screen for its congratulations before moving on.
  const [signedInOnArrival] = useState(() => Boolean(useAuthStore.getState().accessToken));
  if (signedInOnArrival) return <Navigate to="/app" replace />;

  return (
    <div className="relative flex h-dvh justify-center bg-background lg:items-center lg:p-6">
      <img
        src="/splash-munshi.webp"
        alt=""
        className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover object-[center_20%] opacity-15 lg:block"
      />
      <div className="relative flex h-full w-full flex-col overflow-hidden lg:h-[min(780px,92vh)] lg:max-w-lg lg:rounded-3xl lg:border lg:border-border lg:shadow-elevation-3">
        <MunshiWelcomeChat />
      </div>
    </div>
  );
}
