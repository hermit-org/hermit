import { MMKV } from "react-native-mmkv";

// MMKV encryption keys must be <= 16 bytes. The previous key was one byte too
// long and could cause native initialization failures. We keep the first 16
// bytes so any data previously persisted with the truncated key remains readable.
export const hermitStorage = new MMKV({
  id: "hermit-storage",
  encryptionKey: "hermit-default-k",
});
