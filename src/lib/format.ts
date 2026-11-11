const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

const preciseFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,234.50 — for printed bills, where paise matter. */
export function formatMoney(value: number): string {
  return preciseFormatter.format(value);
}

/** 2.5, 10, 0.125 — quantities without trailing zeros. */
export function formatQty(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
