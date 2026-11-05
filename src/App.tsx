import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import i18n from "./lib/i18n";
import { useAuthStore } from "./lib/auth-store";
import { router } from "./routes/router";
import { SplashScreen } from "./components/SplashScreen";

const queryClient = new QueryClient();

function SyncLanguageWithUser() {
  const preferredLanguage = useAuthStore((state) => state.user?.preferredLanguage);

  useEffect(() => {
    if (preferredLanguage && i18n.language !== preferredLanguage) {
      void i18n.changeLanguage(preferredLanguage);
    }
  }, [preferredLanguage]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncLanguageWithUser />
      <SplashScreen>
        <RouterProvider router={router} />
      </SplashScreen>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            borderRadius: "12px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
