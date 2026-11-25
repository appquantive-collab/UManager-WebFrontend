import { createBrowserRouter } from "react-router-dom";
import { TenantAdminLayout } from "../layouts/TenantAdminLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { InventoryPage } from "../pages/inventory/InventoryPage";
import { ProductFormPage } from "../pages/inventory/ProductFormPage";
import { SalesPage } from "../pages/sales/SalesPage";
import { PurchasesPage } from "../pages/purchases/PurchasesPage";
import { CustomersPage } from "../pages/customers/CustomersPage";
import { SuppliersPage } from "../pages/suppliers/SuppliersPage";
import { WarehousesPage } from "../pages/warehouses/WarehousesPage";
import { ReportsPage } from "../pages/reports/ReportsPage";
import { AiPage } from "../pages/ai/AiPage";
import { StaffPage } from "../pages/staff/StaffPage";
import { StaffFormPage } from "../pages/staff/StaffFormPage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { CashbookPage } from "../pages/cashbook/CashbookPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage";
import { LandingPage } from "../pages/landing/LandingPage";
import { WelcomePage } from "../pages/welcome/WelcomePage";
import { SearchPage } from "../pages/search/SearchPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminLayout } from "../layouts/AdminLayout";
import { AdminLoginPage } from "../pages/admin/AdminLoginPage";
import { AdminOverviewPage } from "../pages/admin/AdminOverviewPage";
import { AdminBusinessesPage } from "../pages/admin/AdminBusinessesPage";
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";
import { AdminSettingsPage } from "../pages/admin/AdminSettingsPage";
import { AdminGrowthPage } from "../pages/admin/AdminGrowthPage";
import { AdminCostsPage } from "../pages/admin/AdminCostsPage";
import { CataloguesPage } from "../pages/catalogue/CataloguesPage";
import { ChatsPage } from "../pages/chats/ChatsPage";
import { PublicCataloguePage } from "../pages/catalogue/PublicCataloguePage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/welcome", element: <WelcomePage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  // A shop's shared catalogue: public, no sign-in.
  { path: "/c/:token", element: <PublicCataloguePage /> },
  // VoiceMunshi team console: its own sign-in and session, separate from shop logins.
  { path: "/admin/login", element: <AdminLoginPage /> },
  {
    // Founder's console (PLATFORM_ADMIN logins; signed-out → /admin/login).
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: "growth", element: <AdminGrowthPage /> },
      { path: "costs", element: <AdminCostsPage /> },
      { path: "businesses", element: <AdminBusinessesPage /> },
      { path: "users", element: <AdminUsersPage /> },
      { path: "settings", element: <AdminSettingsPage /> },
    ],
  },
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
          { path: "inventory/new", element: <ProductFormPage /> },
          { path: "inventory/:id/edit", element: <ProductFormPage /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "suppliers", element: <SuppliersPage /> },
          { path: "warehouses", element: <WarehousesPage /> },
          { path: "reports", element: <ReportsPage /> },
          { path: "ai", element: <AiPage /> },
          { path: "search", element: <SearchPage /> },
          { path: "staff", element: <StaffPage /> },
          { path: "staff/new", element: <StaffFormPage /> },
          { path: "staff/:id/edit", element: <StaffFormPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "cashbook", element: <CashbookPage /> },
          { path: "catalogue", element: <CataloguesPage /> },
          { path: "chats", element: <ChatsPage /> },
          { path: "chats/:conversationId", element: <ChatsPage /> },
        ],
      },
    ],
  },
]);
