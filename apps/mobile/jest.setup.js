// Extend expect with jest-native matchers
require("@testing-library/jest-native/extend-expect");

// Initialize i18next for component tests
const i18n = require("i18next");
const { initReactI18next } = require("react-i18next");
const en = require("./src/i18n/locales/en.json");

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v3",
});

// Suppress noisy console.error in tests (Animated node warnings, etc.)
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("Animated:")) return;
  if (typeof args[0] === "string" && args[0].includes("Not implemented:")) return;
  originalError.call(console, ...args);
};
