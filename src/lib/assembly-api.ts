import { apiFetch } from "./api";

export interface RawMaterialAvailability {
  rawMaterialId: string;
  rawMaterialName: string;
  requiredPerUnit: number;
  unit: string;
  currentStock: number;
}

export interface ProducibleResult {
  producibleQuantity: number;
  rawMaterials: RawMaterialAvailability[];
}

export interface AssembleInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  note?: string;
}

export interface AssembleResult {
  producedQuantity: number;
  shortfall: RawMaterialAvailability[];
}

export function getProducibleQuantity(productId: string): Promise<ProducibleResult> {
  return apiFetch(`/assembly/producible/${productId}`);
}

export function assembleProduct(input: AssembleInput): Promise<AssembleResult> {
  return apiFetch("/assembly", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
