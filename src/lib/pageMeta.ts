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

function metaFor(key: string, context?: string): PageMeta {
  return {
    title: i18n.t(`pageMeta.${key}.title`, { context }),
    subtitle: i18n.t(`pageMeta.${key}.subtitle`, { context }),
  };
}

/** `context` is the business wording from useAppSetup().vocab ("firm" for traders/manufacturers). */
export function getPageMeta(pathname: string, context?: string): PageMeta {
  if (/^\/app\/inventory\/[^/]+\/edit$/.test(pathname)) {
    return metaFor("inventoryEdit", context);
  }
  if (/^\/app\/staff\/[^/]+\/edit$/.test(pathname)) {
    return metaFor("staffEdit", context);
  }
  const key = routeKeys[pathname];
  return key ? metaFor(key, context) : metaFor("fallback", context);
}
