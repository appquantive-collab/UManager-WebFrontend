import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { SplashScreen } from "./components/SplashScreen";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SplashScreen>
        <RouterProvider router={router} />
      </SplashScreen>
    </QueryClientProvider>
  );
}
