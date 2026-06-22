import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "./src/i18n";
import { changeAppLanguage } from "./src/i18n";
import { useSettingsStore } from "./src/stores";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { GlobalLoading } from "./src/components/GlobalLoading";

export default function App(): React.JSX.Element {
  const language = useSettingsStore((state) => state.language);

  useEffect(() => {
    changeAppLanguage(language);
  }, [language]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <RootNavigator />
      <GlobalLoading />
    </SafeAreaProvider>
  );
}
