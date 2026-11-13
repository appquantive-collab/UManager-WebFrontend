import {
  Bike,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  Coffee,
  Cookie,
  Dog,
  Flame,
  FlaskConical,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Grid3x3,
  HardHat,
  Landmark,
  Layers,
  Milk,
  Monitor,
  Music,
  Nut,
  Package,
  PackageOpen,
  Pill,
  Printer,
  Recycle,
  Scissors,
  Shirt,
  ShoppingBag,
  ShowerHead,
  Smartphone,
  Sofa,
  Sparkles,
  SprayCan,
  Sprout,
  Trophy,
  UtensilsCrossed,
  Warehouse,
  Watch,
  Wrench,
  Zap,
} from "lucide-react";
import type { BusinessCategory } from "./auth-api";

/** Business categories grouped the way shop owners think of them (labels in onboarding.step1). */
export interface CategoryOption {
  value: BusinessCategory;
  icon: typeof Package;
}

export const categoryGroups: { labelKey: string; items: CategoryOption[] }[] = [
  {
    labelKey: "onboarding.step1.groups.foodFmcgGrocery",
    items: [
      { value: "fmcg", icon: Package },
      { value: "grocery", icon: Building2 },
      { value: "confectionery_bakery", icon: Cookie },
      { value: "dry_fruits_spices", icon: Nut },
      { value: "tea_coffee", icon: Coffee },
      { value: "dairy_products", icon: Milk },
      { value: "agro_seeds_fertilizers", icon: Sprout },
      { value: "cattle_feed", icon: Dog },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.fashionTextiles",
    items: [
      { value: "apparel", icon: Shirt },
      { value: "readymade_garments", icon: ShoppingBag },
      { value: "saree_ethnic_wear", icon: Flower2 },
      { value: "textiles_fabric", icon: Scissors },
      { value: "footwear", icon: Footprints },
      { value: "bags_luggage", icon: Briefcase },
      { value: "watches_eyewear", icon: Watch },
      { value: "jewellery_artificial", icon: Gem },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.electronicsIt",
    items: [
      { value: "electronics", icon: Boxes },
      { value: "mobile_accessories", icon: Smartphone },
      { value: "computer_it", icon: Monitor },
      { value: "electrical_goods", icon: Zap },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.hardwareHomeBuilding",
    items: [
      { value: "hardware", icon: Warehouse },
      { value: "sanitary_plumbing", icon: ShowerHead },
      { value: "paints_chemicals", icon: FlaskConical },
      { value: "building_materials", icon: HardHat },
      { value: "tiles_sanitaryware", icon: Grid3x3 },
      { value: "glass_hardware", icon: Layers },
      { value: "furniture", icon: Sofa },
      { value: "kitchenware_utensils", icon: UtensilsCrossed },
      { value: "plastic_goods", icon: Recycle },
      { value: "cleaning_supplies", icon: SprayCan },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.autoTransport",
    items: [
      { value: "auto_parts", icon: Wrench },
      { value: "two_wheeler_parts", icon: Bike },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.healthBeauty",
    items: [
      { value: "pharma", icon: Pill },
      { value: "cosmetics_beauty", icon: Sparkles },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.stationeryGiftsLeisure",
    items: [
      { value: "stationery_books", icon: BookOpen },
      { value: "printing_stationery", icon: Printer },
      { value: "gift_items", icon: Gift },
      { value: "toys_games", icon: Gamepad2 },
      { value: "sports_goods", icon: Trophy },
      { value: "musical_instruments", icon: Music },
      { value: "packaging_materials", icon: PackageOpen },
    ],
  },
  {
    labelKey: "onboarding.step1.groups.other",
    items: [
      { value: "fireworks", icon: Flame },
      { value: "religious_puja_items", icon: Landmark },
      { value: "other", icon: Sparkles },
    ],
  },
];
