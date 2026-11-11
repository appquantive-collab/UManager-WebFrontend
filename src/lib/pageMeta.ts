import i18n from "./i18n";

export interface PageMeta {
  title: string;
  subtitle: string;
}

const routeKeys: Record<string, string> = {
  "/app": "dashboard",
  "/app/sales": "sales",
  "/app/purchases": "purchases",
  "/app/inventory": "inventory",
  "/app/inventory/new": "inventoryNew",
  "/app/customers": "customers",
  "/app/suppliers": "suppliers",
  "/app/warehouses": "warehouses",
  "/app/reports": "reports",
  "/app/ai": "ai",
  "/app/search": "search",
  "/app/staff": "staff",
  "/app/staff/new": "staffNew",
  "/app/settings": "settings",
  "/app/cashbook": "cashbook",
};

function metaFor(key: string): PageMeta {
  return {
    title: i18n.t(`pageMeta.${key}.title`),
    subtitle: i18n.t(`pageMeta.${key}.subtitle`),
  };
}

export function getPageMeta(pathname: string): PageMeta {
  if (/^\/app\/inventory\/[^/]+\/edit$/.test(pathname)) {
    return metaFor("inventoryEdit");
  }
  if (/^\/app\/staff\/[^/]+\/edit$/.test(pathname)) {
    return metaFor("staffEdit");
  }
  const key = routeKeys[pathname];
  return key ? metaFor(key) : metaFor("fallback");
}
