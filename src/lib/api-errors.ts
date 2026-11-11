import type { TFunction } from "i18next";
import { ApiError } from "./api";

/** Server error codes → translation keys under `errors.`. */
const CODE_KEYS: Record<string, string> = {
  INSUFFICIENT_STOCK: "insufficientStock",
  CREDIT_LIMIT: "creditLimit",
  HAS_PAYMENTS: "hasPayments",
  ALREADY_CANCELLED: "alreadyCancelled",
  CANCELLED: "billCancelled",
  EMAIL_TAKEN: "emailTaken",
  FORBIDDEN: "forbidden",
};

/**
 * The server answers in English; these are the messages a shopkeeper actually
 * sees, so they get translated here (anything unknown falls back to English).
 */
const MESSAGE_KEYS: [RegExp, string][] = [
  [/^Product not found/i, "productNotFound"],
  [/^Customer not found/i, "customerNotFound"],
  [/^Supplier not found/i, "supplierNotFound"],
  [/^Staff member not found/i, "staffNotFound"],
  [/^Order not found/i, "orderNotFound"],
  [/^(Invoice|Bill) not found/i, "billNotFound"],
  [/^Warehouse not found/i, "warehouseNotFound"],
  [/^Purchase not found/i, "purchaseNotFound"],
  [/^Invalid credentials/i, "invalidCredentials"],
  [/^Insufficient permissions/i, "forbidden"],
  [/^Some products were not found/i, "productsMissing"],
  [/^One or more of these orders has already been billed/i, "orderAlreadyBilled"],
  [/^Cannot bill a cancelled order/i, "orderCancelled"],
  [/^Invoice is already fully paid/i, "billAlreadyPaid"],
  [/^Payment exceeds the remaining balance/i, "paymentTooMuch"],
  [/^This purchase is already fully paid/i, "purchaseAlreadyPaid"],
  [/^Paid amount can't be more than/i, "paymentTooMuch"],
  [/^Not enough stock|^Insufficient stock|more than available/i, "insufficientStock"],
  [/^This product has no raw materials/i, "noRecipe"],
  [/^An account with this email already exists/i, "emailTaken"],
  [/^An account with this mobile number already exists/i, "phoneTaken"],
  [/^No account found for this mobile number/i, "noAccountForPhone"],
  [/^Incorrect code/i, "wrongCode"],
  [/^This code has expired/i, "codeExpired"],
  [/^Too many/i, "tooMany"],
  [/^Session expired/i, "sessionExpired"],
  [/^Something went wrong/i, "generic"],
  [/^Request failed: 5\d\d/i, "generic"],
  [/Failed to fetch|NetworkError|Load failed/i, "offline"],
];

export function errorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    const byCode = err.code ? CODE_KEYS[err.code] : undefined;
    if (byCode) return t(`errors.${byCode}`);
    const match = MESSAGE_KEYS.find(([pattern]) => pattern.test(err.message));
    if (match) return t(`errors.${match[1]}`);
    if (err.status >= 500) return t("errors.generic");
    return err.message;
  }
  if (err instanceof Error) {
    const match = MESSAGE_KEYS.find(([pattern]) => pattern.test(err.message));
    if (match) return t(`errors.${match[1]}`);
  }
  return t("errors.generic");
}
