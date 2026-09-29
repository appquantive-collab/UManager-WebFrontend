import { apiFetch, apiUpload } from "./api";

export interface BomLine {
  rawMaterialId: string;
  quantity: number;
  unit: string;
}

export interface Product {
  _id: string;
  tenantId: string;
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  brand?: string;
  imageUrl?: string;
  unit: string;
  hsn?: string;
  gstPercent?: number;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  minimumPrice?: number;
  reorderLevel: number;
  isActive: boolean;
  isRawMaterial: boolean;
  bom: BomLine[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  brand?: string;
  imageUrl?: string;
  unit: string;
  hsn?: string;
  gstPercent?: number;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  minimumPrice?: number;
  reorderLevel: number;
  isRawMaterial?: boolean;
  bom?: BomLine[];
}

export function listProducts(options?: { rawMaterial?: boolean }): Promise<Product[]> {
  const qs = options?.rawMaterial !== undefined ? `?rawMaterial=${options.rawMaterial}` : "";
  return apiFetch<Product[]>(`/products${qs}`);
}

export function getProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`);
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

export function uploadProductImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("image", file);
  return apiUpload<{ url: string }>("/uploads/product-image", formData);
}

export function getProductQr(id: string): Promise<{ sku: string; qrDataUrl: string }> {
  return apiFetch(`/products/${id}/qr`);
}
