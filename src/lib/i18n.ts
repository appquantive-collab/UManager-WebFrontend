import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../locales/en.json";
import hi from "../locales/hi.json";
import hiLatn from "../locales/hi-Latn.json";

export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "hi-Latn", label: "Hinglish" },
  { code: "hi", label: "हिन्दी" },
] as const;

export type SupportedLanguageCode = (typeof supportedLanguages)[number]["code"];

export function currentLanguage(): SupportedLanguageCode {
  const resolved = i18n.resolvedLanguage;
  return supportedLanguages.find((lang) => lang.code === resolved)?.code ?? "en";
}

// Keeps <html lang> in step so the browser picks Devanagari shaping, hyphenation and voices for Hindi.
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      "hi-Latn": { translation: hiLatn },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "hi", "hi-Latn"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "umanager.language",
      caches: ["localStorage"],
    },
  });

export default i18n;
