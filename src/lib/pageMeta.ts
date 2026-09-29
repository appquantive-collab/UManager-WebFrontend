export interface PageMeta {
  title: string;
  subtitle: string;
}

// Maps each tenant-admin route (under /app) to the title/subtitle rendered in the shared header.
export const pageMeta: Record<string, PageMeta> = {
  "/app": { title: "Dashboard", subtitle: "Business overview for today." },
  "/app/sales": { title: "Sales", subtitle: "Orders, invoices, and payments." },
  "/app/purchases": { title: "Purchases", subtitle: "Purchase orders and supplier payments." },
  "/app/inventory": { title: "Inventory", subtitle: "Manage your products and pricing." },
  "/app/inventory/new": { title: "Add product", subtitle: "Create a new product or raw material." },
  "/app/customers": { title: "Customers", subtitle: "Customer accounts, credit, and ledgers." },
  "/app/suppliers": { title: "Suppliers", subtitle: "Supplier accounts and payment ledgers." },
  "/app/warehouses": { title: "Warehouses", subtitle: "Locations, stock value, and transfers." },
  "/app/reports": { title: "Reports", subtitle: "Business performance across sales, purchases, and inventory." },
  "/app/ai": { title: "AI Assistant", subtitle: "Ask about your business or review AI-generated insights." },
  "/app/staff": { title: "Staff", subtitle: "Hire people and give each access to only the features they need." },
  "/app/settings": { title: "Settings", subtitle: "Business configuration and preferences." },
};

export function getPageMeta(pathname: string): PageMeta {
  if (/^\/app\/inventory\/[^/]+\/edit$/.test(pathname)) {
    return { title: "Edit product", subtitle: "Update product or raw material details." };
  }
  return pageMeta[pathname] ?? { title: "UManager", subtitle: "" };
}
