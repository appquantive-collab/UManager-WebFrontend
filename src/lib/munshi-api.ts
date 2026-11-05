import { apiFetch } from "./api";
import type { SupportedLanguageCode } from "./i18n";

/** Ask Munshi AI a question about SethSathi from the pre-login chat. Short, product-only answers. */
export function askMunshi(question: string, lang: SupportedLanguageCode): Promise<{ reply: string }> {
  return apiFetch<{ reply: string }>("/munshi/ask", {
    method: "POST",
    body: JSON.stringify({ question, lang }),
  });
}
