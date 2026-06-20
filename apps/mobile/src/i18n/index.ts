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

function resolveDeviceLanguage(): Language {
  const locales = RNLocalize.getLocales();
  const deviceLanguage = locales[0]?.languageCode as Language | undefined;
  return deviceLanguage && resources[deviceLanguage] ? deviceLanguage : fallback;
}

function resolveStoredLanguage(): Language | "system" | null {
  try {
    const raw = hermitStorage.getString("hermit-settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { language?: Language | "system" } };
    return parsed.state?.language ?? null;
  } catch {
    return null;
  }
}

export function resolveEffectiveLanguage(language: Language | "system"): Language {
  return language === "system" ? resolveDeviceLanguage() : language;
}

const storedLanguage = resolveStoredLanguage();
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
