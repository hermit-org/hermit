import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

export const resources = {
  en: { translation: en },
  zh: { translation: zh },
} as const;

export type Language = keyof typeof resources;

const fallback: Language = "en";

const browserLanguage = navigator.language.split("-")[0] as Language | undefined;
const initialLanguage: Language =
  browserLanguage && resources[browserLanguage] ? browserLanguage : fallback;

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: fallback,
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: "v3",
});

export default i18n;
