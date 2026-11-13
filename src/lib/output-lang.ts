import i18n from "./i18n";

/**
 * Everything that leaves the app — bills (A4, receipt, WhatsApp bill text),
 * report downloads and printed reports — is always in English, whatever
 * language the screens are in. Screens keep the person's language.
 */
export const outT = i18n.getFixedT("en");

/**
 * Prints the current page in English: switches the screen language to English
 * just for the print, then back.
 */
export async function printInEnglish() {
  const previous = i18n.resolvedLanguage ?? i18n.language;
  if (previous === "en") {
    window.print();
    return;
  }
  await i18n.changeLanguage("en");
  // Let React repaint in English before the print dialog snapshots the page.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  try {
    window.print();
  } finally {
    await i18n.changeLanguage(previous);
  }
}
