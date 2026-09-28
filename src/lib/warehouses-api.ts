import { apiFetch } from "./api";

export interface WarehouseListItem {
  _id: string;
  name: string;
  location?: string;
  isDefault: boolean;
  isActive: boolean;
  stockValue: number;
  skuCount: number;
  createdAt: string;
}

export interface CreateWarehouseInput {
  name: string;
  location?: string;
}

export function listWarehousesWithStats(): Promise<WarehouseListItem[]> {
  return apiFetch("/warehouses");
}

export function createWarehouse(input: CreateWarehouseInput): Promise<WarehouseListItem> {
  return apiFetch("/warehouses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
