import { apiFetch } from "./api";

export interface Category {
  _id: string;
  name: string;
}

export interface Brand {
  _id: string;
  name: string;
}

export function listCategories(): Promise<Category[]> {
  return apiFetch("/catalog/categories");
}

export function createCategory(name: string): Promise<Category> {
  return apiFetch("/catalog/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function listBrands(): Promise<Brand[]> {
  return apiFetch("/catalog/brands");
}

export function createBrand(name: string): Promise<Brand> {
  return apiFetch("/catalog/brands", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
