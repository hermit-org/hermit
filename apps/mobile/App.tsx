import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import i18n, { Language } from "./src/i18n";
import type { User } from "@hermit/types";
import { formatId } from "@hermit/utils";

const user: User = {
  id: formatId("123"),
  name: "Hermit",
};

export default function App(): React.JSX.Element {
  const { t } = useTranslation();

  const toggleLanguage = (): void => {
    const next: Language = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(next);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View>
        <Text style={styles.title}>{t("title")}</Text>
        <Text style={styles.label}>{t("userId", { id: user.id })}</Text>
        <Text style={styles.label}>{t("userName", { name: user.name })}</Text>

        <TouchableOpacity style={styles.button} onPress={toggleLanguage}>
          <Text style={styles.buttonText}>{t("switchLanguage")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  button: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
});
