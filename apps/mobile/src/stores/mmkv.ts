import { MMKV } from "react-native-mmkv";

export const hermitStorage = new MMKV({
  id: "hermit-storage",
  encryptionKey: "hermit-default-key",
});
