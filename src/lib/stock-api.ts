import { apiFetch } from "./api";

export interface Warehouse {
  _id: string;
  tenantId: string;
  name: string;
  location?: string;
  isDefault: boolean;
  isActive: boolean;
}

export type StockMovementType =
  | "opening"
  | "purchase"
  | "sale"
  | "customer_return"
  | "supplier_return"
  | "adjustment"
  | "damage"
  | "transfer_in"
  | "transfer_out";

export interface StockMovement {
  _id: string;
  tenantId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  movementType: StockMovementType;
  note?: string;
  referenceId?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateMovementInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  movementType: StockMovementType;
  note?: string;
  referenceId?: string;
}

export interface ProductStockLevel {
  total: number;
  warehouses: Record<string, number>;
}

export function listWarehouses(): Promise<Warehouse[]> {
  return apiFetch<Warehouse[]>("/warehouses");
}

export function getStockLevels(): Promise<Record<string, ProductStockLevel>> {
  return apiFetch<Record<string, ProductStockLevel>>("/stock/levels");
}

export function getProductStockLevel(productId: string): Promise<ProductStockLevel> {
  return apiFetch<ProductStockLevel>(`/stock/levels/${productId}`);
}

export function listStockMovements(productId: string): Promise<StockMovement[]> {
  return apiFetch<StockMovement[]>(`/stock/movements/${productId}`);
}

export function createStockMovement(input: CreateMovementInput): Promise<StockMovement> {
  return apiFetch<StockMovement>("/stock/movements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
