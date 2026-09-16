import { createBrowserRouter } from "react-router-dom";
import { TenantAdminLayout } from "../layouts/TenantAdminLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <TenantAdminLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "sales", element: <PlaceholderPage title="Sales" /> },
      { path: "purchases", element: <PlaceholderPage title="Purchases" /> },
      { path: "inventory", element: <PlaceholderPage title="Inventory" /> },
      { path: "customers", element: <PlaceholderPage title="Customers" /> },
      { path: "suppliers", element: <PlaceholderPage title="Suppliers" /> },
      { path: "warehouses", element: <PlaceholderPage title="Warehouses" /> },
      { path: "reports", element: <PlaceholderPage title="Reports" /> },
      { path: "ai", element: <PlaceholderPage title="AI Assistant" /> },
      { path: "staff", element: <PlaceholderPage title="Staff" /> },
      { path: "settings", element: <PlaceholderPage title="Settings" /> },
    ],
  },
]);
