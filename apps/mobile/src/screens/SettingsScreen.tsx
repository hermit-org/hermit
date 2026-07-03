import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores";

export function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    thoughtPreviewLines,
    setThoughtPreviewLines,
    autoArchiveThreshold,
    setAutoArchiveThreshold,
    autoAuthenticate,
    setAutoAuthenticate,
  } = useSettingsStore();

  const themeLabels: Record<string, string> = {
    light: t("settings.themeLight"),
    dark: t("settings.themeDark"),
    system: t("settings.themeSystem"),
  };

  const languageLabels: Record<string, string> = {
    en: t("settings.languageEn"),
    zh: t("settings.languageZh"),
    system: t("settings.languageSystem"),
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>{t("settings.title")}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.appearance")}</Text>
          <View style={styles.row}>
            <Text>{t("settings.theme")}</Text>
            <View style={styles.themeButtons}>
              {(["light", "dark", "system"] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.themeButton,
                    theme === v && styles.themeButtonActive,
                  ]}
                  onPress={() => setTheme(v)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={themeLabels[v]}
                  accessibilityState={{ selected: theme === v }}
                >
                  <Text style={theme === v ? styles.activeText : undefined}>
                    {themeLabels[v]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.row}>
            <Text>{t("settings.language")}</Text>
            <View style={styles.themeButtons}>
              {(["en", "zh", "system"] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[
                    styles.themeButton,
                    language === l && styles.themeButtonActive,
                  ]}
                  onPress={() => setLanguage(l)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={languageLabels[l]}
                  accessibilityState={{ selected: language === l }}
                >
                  <Text style={language === l ? styles.activeText : undefined}>
                    {languageLabels[l]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.chat")}</Text>
          <View style={styles.row}>
            <Text>{t("settings.thoughtPreviewLines")}</Text>
            <TextInput
              style={styles.numberInput}
              value={String(thoughtPreviewLines)}
              onChangeText={(v) => setThoughtPreviewLines(Number(v) || 0)}
              keyboardType="number-pad"
              accessibilityLabel={t("settings.thoughtPreviewLines")}
            />
          </View>
          <View style={styles.row}>
            <Text>{t("settings.autoArchiveThreshold")}</Text>
            <TextInput
              style={styles.textInput}
              value={autoArchiveThreshold}
              onChangeText={setAutoArchiveThreshold}
              placeholder={t("settings.autoArchivePlaceholder")}
              accessibilityLabel={t("settings.autoArchiveThreshold")}
            />
          </View>
          <View style={styles.row}>
            <Text>{t("settings.autoAuthenticate")}</Text>
            <Switch
              value={autoAuthenticate}
              onValueChange={setAutoAuthenticate}
              accessibilityLabel={t("settings.autoAuthenticate")}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  themeButtons: {
    flexDirection: "row",
    gap: 8,
  },
  themeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    minHeight: 44,
    justifyContent: "center",
  },
  themeButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  activeText: {
    color: "#fff",
  },
  numberInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    width: 60,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "center",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    width: 120,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "right",
  },
});
