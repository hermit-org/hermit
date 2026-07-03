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
import { FEATURE_FLAGS } from "../lib/feature-flags";

export function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const s = useSettingsStore();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>{t("settings.title")}</Text>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.appearance")}</Text>
          <View style={styles.row}>
            <Text>{t("settings.theme")}</Text>
            <View style={styles.buttonGroup}>
              {(["light", "dark", "system"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.choiceBtn,
                    s.theme === opt && styles.choiceBtnActive,
                  ]}
                  onPress={() => s.setTheme(opt)}
                >
                  <Text
                    style={s.theme === opt ? styles.activeText : undefined}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.row}>
            <Text>{t("settings.language")}</Text>
            <View style={styles.buttonGroup}>
              {(["en", "zh", "system"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.choiceBtn,
                    s.language === opt && styles.choiceBtnActive,
                  ]}
                  onPress={() => s.setLanguage(opt)}
                >
                  <Text
                    style={s.language === opt ? styles.activeText : undefined}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Chat */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.chat")}</Text>
          <View style={styles.row}>
            <Text>{t("settings.thoughtPreviewLines")}</Text>
            <TextInput
              style={styles.numberInput}
              value={String(s.thoughtPreviewLines)}
              onChangeText={(v) => s.setThoughtPreviewLines(Number(v) || 0)}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.row}>
            <Text>{t("settings.autoArchiveThreshold")}</Text>
            <TextInput
              style={styles.textInput}
              value={s.autoArchiveThreshold}
              onChangeText={s.setAutoArchiveThreshold}
              placeholder={t("settings.autoArchivePlaceholder")}
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.row}>
            <Text>{t("settings.autoAuthenticate")}</Text>
            <Switch
              value={s.autoAuthenticate}
              onValueChange={s.setAutoAuthenticate}
            />
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.features")}</Text>
          {FEATURE_FLAGS.map((flag) => {
            const value = s[flag.key] as boolean;
            const setter = s[
              `set${flag.key.charAt(0).toUpperCase()}${flag.key.slice(1)}` as keyof typeof s
            ] as (v: boolean) => void;
            return (
              <View key={flag.key}>
                <View style={styles.row}>
                  <View style={styles.labelCol}>
                    <Text>{t(flag.labelKey)}</Text>
                    <Text style={styles.hint}>{t(flag.hintKey)}</Text>
                  </View>
                  <Switch value={value} onValueChange={setter} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Archive */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.archive")}</Text>
          <View style={styles.row}>
            <Text>{t("settings.showArchivedSessions")}</Text>
            <Switch
              value={s.showArchivedSessions}
              onValueChange={s.setShowArchivedSessions}
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.about")}</Text>
          <View style={styles.row}>
            <Text>{t("settings.version")}</Text>
            <Text style={styles.aboutValue}>0.0.6-alpha.11</Text>
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
  labelCol: {
    flex: 1,
    paddingRight: 12,
  },
  hint: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 8,
  },
  choiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  choiceBtnActive: {
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
    paddingVertical: 4,
    textAlign: "center",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    width: 120,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: "right",
  },
  aboutValue: {
    fontSize: 14,
    color: "#666",
  },
});
