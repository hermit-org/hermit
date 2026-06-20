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
const supportedLanguages = Object.keys(resources) as Language[];

function resolveBrowserLanguage(): Language {
  const code = navigator.language.split("-")[0] as Language | undefined;
  return code && resources[code] ? code : fallback;
}

function resolveStoredLanguage(): Language | "system" | null {
  try {
    const raw = localStorage.getItem("hermit-settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { language?: Language | "system" } };
    const value = parsed.state?.language;
    if (value === "en" || value === "zh" || value === "system") return value;
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export function resolveEffectiveLanguage(language: Language | "system"): Language {
  return language === "system" ? resolveBrowserLanguage() : language;
}

const storedLanguage = resolveStoredLanguage();
const initialLanguage = resolveEffectiveLanguage(storedLanguage ?? "system");

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: fallback,
  supportedLngs: supportedLanguages,
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: "v3",
});

export function changeAppLanguage(language: Language | "system"): void {
  void i18n.changeLanguage(resolveEffectiveLanguage(language));
}

export { supportedLanguages };
export default i18n;
