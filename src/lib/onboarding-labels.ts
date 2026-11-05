import i18n from "./i18n";
import type { BusinessCategory, BusinessGoal, CustomerType, OrderVolume } from "./auth-api";

export function categoryLabel(value: BusinessCategory): string {
  return i18n.t(`onboardingLabels.category.${value}`);
}

export function customerTypeLabel(value: CustomerType): string {
  return i18n.t(`onboardingLabels.customerType.${value}`);
}

export function orderVolumeLabel(value: OrderVolume): string {
  return i18n.t(`onboardingLabels.orderVolume.${value}`);
}

export function goalLabel(value: BusinessGoal): string {
  return i18n.t(`onboardingLabels.goal.${value}`);
}
