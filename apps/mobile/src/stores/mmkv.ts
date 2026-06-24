import { MMKV } from "react-native-mmkv";

/**
 * MMKV storage instance for the Hermit mobile app.
 *
 * NOTE: Do NOT hardcode an encryption key here. MMKV encrypts data with the
 * provided key, but a key shipped in source code offers no security. If
 * encryption is required, derive a per-installation key from the Android
 * Keystore / iOS Keychain at runtime and pass it in.
 */
export const hermitStorage = new MMKV({
  id: "hermit-storage",
});
