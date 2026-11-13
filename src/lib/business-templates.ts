import type { AppFeatures, AppSetup, BusinessCategory, BusinessRole, OnlineChannel } from "./auth-api";

/**
 * Ready-made ways to run a business on SethSathi. Setup suggests 3–4 of these
 * from the owner's answers; the chosen one decides the default bill type,
 * which parts of the app are shown, and starter item categories.
 * Names and descriptions live in locales under `setupTemplates.<key>`.
 */
export type TemplateKey =
  | "kirana_counter"
  | "retail_gst"
  | "wholesale_trader"
  | "manufacturer"
  | "medical_store"
  | "mobile_electronics"
  | "fashion_store"
  | "online_seller";

interface TemplateDef {
  key: TemplateKey;
  defaultBillType: "gst" | "record";
  features: AppFeatures;
  /** Keys under setupTemplates.points — what this setup gives them. */
  points: string[];
  categories?: string[];
}

const F = (on: Partial<AppFeatures>): AppFeatures => ({
  counterSale: false,
  orders: false,
  purchases: true,
  warehouses: false,
  rawMaterials: false,
  batch: false,
  serial: false,
  variants: false,
  staff: false,
  creditLimits: true,
  cashbook: false,
  ...on,
});

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  kirana_counter: {
    key: "kirana_counter",
    defaultBillType: "record",
    features: F({ counterSale: true, cashbook: true }),
    points: ["counterBilling", "udhaarKhata", "lowStock", "cashbook"],
  },
  retail_gst: {
    key: "retail_gst",
    defaultBillType: "gst",
    features: F({ counterSale: true, cashbook: true, staff: true }),
    points: ["gstBills", "upiQr", "counterBilling", "gstReport"],
  },
  wholesale_trader: {
    key: "wholesale_trader",
    defaultBillType: "gst",
    features: F({ orders: true, warehouses: true, staff: true }),
    points: ["whatsappOrders", "creditLimit", "gstBills", "supplierDues"],
  },
  manufacturer: {
    key: "manufacturer",
    defaultBillType: "gst",
    features: F({ orders: true, warehouses: true, rawMaterials: true, staff: true }),
    points: ["rawMaterials", "assembly", "dealerOrders", "staffPayroll"],
    categories: ["Raw Material", "Finished Goods", "Packing Material"],
  },
  medical_store: {
    key: "medical_store",
    defaultBillType: "gst",
    features: F({ counterSale: true, cashbook: true, batch: true, staff: true }),
    points: ["batchExpiry", "expiringList", "gstBills", "counterBilling"],
  },
  mobile_electronics: {
    key: "mobile_electronics",
    defaultBillType: "gst",
    features: F({ counterSale: true, cashbook: true, serial: true, staff: true }),
    points: ["imei", "imeiSearch", "gstBills", "returns"],
  },
  fashion_store: {
    key: "fashion_store",
    defaultBillType: "record",
    features: F({ counterSale: true, cashbook: true, variants: true, staff: true }),
    points: ["sizesColours", "counterBilling", "importExcel", "returns"],
  },
  online_seller: {
    key: "online_seller",
    defaultBillType: "gst",
    features: F({ orders: true, warehouses: true }),
    points: ["ordersOnePlace", "stockAllChannels", "gstBills", "returns"],
  },
};

const PHARMA: BusinessCategory[] = ["pharma"];
const SERIAL: BusinessCategory[] = ["mobile_accessories", "electronics", "computer_it"];
const FASHION: BusinessCategory[] = ["apparel", "readymade_garments", "saree_ethnic_wear", "footwear", "textiles_fabric", "bags_luggage"];

export interface SetupAnswers {
  category: BusinessCategory | null;
  roles: BusinessRole[];
  needs: { batch: boolean; serial: boolean; variants: boolean; rawMaterials: boolean };
  sellsOnline: OnlineChannel[];
  hasGst: boolean | null;
  staffCount: number;
  warehouseCount: number;
}

/** 3–4 setups for these answers, best match first. */
export function suggestTemplates(a: SetupAnswers): TemplateKey[] {
  const out: TemplateKey[] = [];
  const add = (k: TemplateKey) => {
    if (!out.includes(k)) out.push(k);
  };
  const industry: TemplateKey | null =
    a.needs.batch || (a.category && PHARMA.includes(a.category))
      ? "medical_store"
      : a.needs.serial || (a.category && SERIAL.includes(a.category))
        ? "mobile_electronics"
        : a.needs.variants || (a.category && FASHION.includes(a.category))
          ? "fashion_store"
          : null;
  const retailer: TemplateKey = a.hasGst ? "retail_gst" : "kirana_counter";

  if (a.roles.includes("manufacturer") || a.needs.rawMaterials) add("manufacturer");
  if (industry) add(industry);
  if (a.roles.includes("trader")) add("wholesale_trader");
  if (a.roles.includes("retailer") || a.roles.length === 0) add(retailer);
  if (a.sellsOnline.length > 0) add("online_seller");
  for (const k of [retailer, "wholesale_trader", "kirana_counter", "retail_gst", "manufacturer"] as TemplateKey[]) {
    if (out.length >= 4) break;
    add(k);
  }
  return out.slice(0, 4);
}

/** The template adjusted to this business (GST, staff, godowns, trade needs). */
export function buildAppSetup(key: TemplateKey, a: SetupAnswers): AppSetup {
  const t = TEMPLATES[key];
  const features: AppFeatures = { ...t.features };
  if (a.needs.batch) features.batch = true;
  if (a.needs.serial) features.serial = true;
  if (a.needs.variants) features.variants = true;
  if (a.needs.rawMaterials || a.roles.includes("manufacturer")) features.rawMaterials = true;
  if (a.roles.includes("retailer")) {
    features.counterSale = true;
    features.cashbook = true;
  }
  if (a.roles.includes("trader") || a.sellsOnline.length > 0) features.orders = true;
  if (a.staffCount > 1) features.staff = true;
  if (a.warehouseCount > 1) features.warehouses = true;
  return {
    template: key,
    defaultBillType: a.hasGst === false ? "record" : t.defaultBillType,
    features,
  };
}

const CATEGORY_SETS: [BusinessCategory[], string[]][] = [
  [["grocery", "fmcg"], ["Grocery", "Snacks & Biscuits", "Beverages", "Personal Care", "Household", "Dairy"]],
  [["confectionery_bakery"], ["Namkeen", "Sweets", "Biscuits", "Bakery", "Packing Material"]],
  [["dry_fruits_spices"], ["Dry Fruits", "Whole Spices", "Ground Spices", "Packing Material"]],
  [["dairy_products"], ["Milk", "Curd & Paneer", "Ghee & Butter", "Sweets"]],
  [["tea_coffee"], ["Tea", "Coffee", "Packing Material"]],
  [["pharma"], ["Tablets", "Syrups", "Injections", "Surgical", "OTC & Wellness"]],
  [["mobile_accessories"], ["Mobiles", "Chargers & Cables", "Covers & Glass", "Earphones", "Accessories"]],
  [["electronics", "electrical_goods"], ["Appliances", "Lighting", "Wires & Switches", "Fans", "Accessories"]],
  [["computer_it"], ["Laptops", "Desktops", "Printers", "Accessories", "Networking"]],
  [["apparel", "readymade_garments"], ["Men", "Women", "Kids", "Winter Wear", "Accessories"]],
  [["saree_ethnic_wear"], ["Sarees", "Suits", "Lehenga", "Dupatta", "Blouse"]],
  [["textiles_fabric"], ["Cotton", "Silk", "Polyester", "Suiting & Shirting"]],
  [["footwear"], ["Men", "Women", "Kids", "Sports Shoes", "Chappal & Sandals"]],
  [["hardware", "sanitary_plumbing", "tiles_sanitaryware", "glass_hardware"], ["Tools", "Fittings", "Pipes", "Sanitary", "Paints"]],
  [["building_materials"], ["Cement", "Steel", "Bricks & Blocks", "Sand & Aggregates"]],
  [["paints_chemicals"], ["Interior Paint", "Exterior Paint", "Primer", "Chemicals"]],
  [["cosmetics_beauty"], ["Skin Care", "Hair Care", "Makeup", "Fragrance"]],
  [["stationery_books", "printing_stationery"], ["Notebooks", "Pens", "Books", "Office Supplies"]],
  [["auto_parts", "two_wheeler_parts"], ["Engine Parts", "Brakes", "Electricals", "Lubricants", "Accessories"]],
  [["agro_seeds_fertilizers", "cattle_feed"], ["Seeds", "Fertilizers", "Pesticides", "Cattle Feed"]],
  [["kitchenware_utensils", "plastic_goods"], ["Steel Utensils", "Plastic Ware", "Appliances", "Storage"]],
];

/** Starter item categories created with the setup. */
export function starterCategoriesFor(category: BusinessCategory | null, key: TemplateKey): string[] {
  const set = (category && CATEGORY_SETS.find(([cats]) => cats.includes(category))?.[1]) || ["General"];
  return [...new Set([...set, ...(TEMPLATES[key].categories ?? [])])].slice(0, 10);
}

/** Owner-facing goals derived from the setup (kept for the AI dashboard). */
export function goalsFor(setup: AppSetup): ("inventory_tracking" | "credit_payments" | "multi_warehouse" | "staff_management" | "ai_insights" | "reporting")[] {
  const goals: ReturnType<typeof goalsFor> = ["inventory_tracking", "ai_insights", "reporting"];
  if (setup.features.creditLimits) goals.push("credit_payments");
  if (setup.features.warehouses) goals.push("multi_warehouse");
  if (setup.features.staff) goals.push("staff_management");
  return goals;
}

export const ALL_FEATURES_ON: AppFeatures = {
  counterSale: true,
  orders: true,
  purchases: true,
  warehouses: true,
  rawMaterials: true,
  batch: true,
  serial: true,
  variants: true,
  staff: true,
  creditLimits: true,
  cashbook: true,
};
