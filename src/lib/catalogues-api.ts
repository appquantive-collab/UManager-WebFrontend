import { API_BASE_URL, apiFetch } from "./api";

export type CataloguePrice = "retail" | "wholesale" | "hidden";

export interface Catalogue {
  _id: string;
  title: string;
  note?: string;
  productIds: string[];
  price: CataloguePrice;
  showStock: boolean;
  token: string;
  productCount?: number;
  updatedAt: string;
}

export interface CatalogueInput {
  title: string;
  note?: string;
  productIds: string[];
  price: CataloguePrice;
  showStock: boolean;
}

export interface PublicCatalogue {
  title: string;
  note: string | null;
  price: CataloguePrice;
  updatedAt: string;
  business: { name: string; phone: string | null; address: string | null };
  items: {
    id: string;
    name: string;
    category: string | null;
    brand: string | null;
    imageUrl: string | null;
    unit: string;
    size: string | null;
    color: string | null;
    price: number | null;
    inStock: boolean | null;
  }[];
}

export function listCatalogues(): Promise<Catalogue[]> {
  return apiFetch("/catalogues");
}

export function createCatalogue(input: CatalogueInput): Promise<Catalogue> {
  return apiFetch("/catalogues", { method: "POST", body: JSON.stringify(input) });
}

export function updateCatalogue(id: string, input: CatalogueInput): Promise<Catalogue> {
  return apiFetch(`/catalogues/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteCatalogue(id: string): Promise<void> {
  return apiFetch(`/catalogues/${id}`, { method: "DELETE" });
}

/** Public: no sign-in (a customer opening the shared link). */
export async function getPublicCatalogue(token: string): Promise<PublicCatalogue> {
  const res = await fetch(`${API_BASE_URL}/public/catalogues/${encodeURIComponent(token)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Couldn't open this catalogue.");
  return body as PublicCatalogue;
}

/** The link to share: this site's /c/<token>. */
export const catalogueLink = (token: string) => `${window.location.origin}/c/${token}`;
