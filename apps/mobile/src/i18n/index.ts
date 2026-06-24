import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as RNLocalize from "react-native-localize";
import { hermitStorage } from "../stores/mmkv";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

export const resources = {
  en: { translation: en },
  zh: { translation: zh },
} as const;

export type Language = keyof typeof resources;

const fallback: Language = "en";
const supportedLanguages = Object.keys(resources) as Language[];
const LANGUAGE_STORAGE_KEY = "hermit-language";

function resolveDeviceLanguage(): Language {
  const locales = RNLocalize.getLocales();
  const deviceLanguage = locales[0]?.languageCode as Language | undefined;
  return deviceLanguage && resources[deviceLanguage] ? deviceLanguage : fallback;
}

/**
 * Read the persisted language preference from its own MMKV key.
 * Keeping this separate from the Zustand persist blob avoids coupling i18n
 * init to the settings store's internal serialized shape.
 */
export function getStoredLanguage(): Language | "system" | null {
  try {
    const raw = hermitStorage.getString(LANGUAGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Language | "system";
    return parsed === "system" || resources[parsed] ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persist the language preference to a dedicated MMKV key.
 * The settings store should call this whenever the user changes language.
 */
export function setStoredLanguage(language: Language | "system"): void {
  hermitStorage.set(LANGUAGE_STORAGE_KEY, JSON.stringify(language));
}

export function resolveEffectiveLanguage(language: Language | "system"): Language {
  return language === "system" ? resolveDeviceLanguage() : language;
}

const storedLanguage = getStoredLanguage();
const initialLanguage = resolveEffectiveLanguage(storedLanguage ?? "system");

i18n
  .use(initReactI18next)
  .init({
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
  const effective = resolveEffectiveLanguage(language);
  void i18n.changeLanguage(effective);
}

export { supportedLanguages };
export default i18n;
