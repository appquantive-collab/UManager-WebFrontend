import { createBrowserRouter } from "react-router-dom";
import { TenantAdminLayout } from "../layouts/TenantAdminLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { InventoryPage } from "../pages/inventory/InventoryPage";
import { SalesPage } from "../pages/sales/SalesPage";
import { PurchasesPage } from "../pages/purchases/PurchasesPage";
import { CustomersPage } from "../pages/customers/CustomersPage";
import { SuppliersPage } from "../pages/suppliers/SuppliersPage";
import { WarehousesPage } from "../pages/warehouses/WarehousesPage";
import { ReportsPage } from "../pages/reports/ReportsPage";
import { AiPage } from "../pages/ai/AiPage";
import { StaffPage } from "../pages/staff/StaffPage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage";
import { LandingPage } from "../pages/landing/LandingPage";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/app",
        element: <TenantAdminLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "sales", element: <SalesPage /> },
          { path: "purchases", element: <PurchasesPage /> },
          { path: "inventory", element: <InventoryPage /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "suppliers", element: <SuppliersPage /> },
          { path: "warehouses", element: <WarehousesPage /> },
          { path: "reports", element: <ReportsPage /> },
          { path: "ai", element: <AiPage /> },
          { path: "staff", element: <StaffPage /> },
          { path: "settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
