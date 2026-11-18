import { z } from "zod";
import i18n from "./i18n";

/**
 * Number fields in forms. What people type ("14,500", "₹500", " 25 ") or leave
 * empty is cleaned before checking, so they never see zod's raw "expected
 * number, received NaN" — only a clear message in their language.
 */
function clean(emptyAs: number | undefined) {
  return (value: unknown) => {
    if (typeof value === "number") return Number.isNaN(value) ? emptyAs : value;
    if (value === undefined || value === null) return emptyAs;
    const text = String(value).replace(/[₹,\s]/g, "");
    if (text === "") return emptyAs;
    return Number(text);
  };
}

/** A number that must be filled in. `rules` adds limits, e.g. (n) => n.positive({ error: … }). */
export function requiredNumber(rules: (n: z.ZodNumber) => z.ZodType<number> = (n) => n, emptyMessage?: () => string) {
  return z.preprocess(
    clean(undefined),
    rules(
      z.number({
        error: (issue) => (issue.input === undefined ? (emptyMessage?.() ?? i18n.t("common.enterNumber")) : i18n.t("common.validNumber")),
      })
    )
  );
}

/** A number that may be left empty (→ undefined). */
export function optionalNumber(rules: (n: z.ZodNumber) => z.ZodType<number> = (n) => n) {
  return z.preprocess(clean(undefined), rules(z.number({ error: () => i18n.t("common.validNumber") })).optional());
}

/** Empty counts as 0 (prices and levels people often skip). */
export function numberOrZero(rules: (n: z.ZodNumber) => z.ZodType<number> = (n) => n) {
  return z.preprocess(clean(0), rules(z.number({ error: () => i18n.t("common.validNumber") })));
}
