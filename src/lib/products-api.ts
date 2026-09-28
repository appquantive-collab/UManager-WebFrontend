import { apiFetch } from "./api";

export interface Product {
  _id: string;
  tenantId: string;
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  brand?: string;
  unit: string;
  hsn?: string;
  gstPercent?: number;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  minimumPrice?: number;
  reorderLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  brand?: string;
  unit: string;
  hsn?: string;
  gstPercent?: number;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  minimumPrice?: number;
  reorderLevel: number;
}

export function listProducts(): Promise<Product[]> {
  return apiFetch<Product[]>("/products");
}

export function createProduct(input: ProductInput): Promise<Product> {
  return apiFetch<Product>("/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: string): Promise<void> {
  return apiFetch<void>(`/products/${id}`, { method: "DELETE" });
}
