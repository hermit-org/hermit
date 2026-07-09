import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, Clipboard, ScrollView } from "react-native";
// import CodeHighlighter from "react-native-code-highlighter";
// import { atomOneDark, atomOneLight } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores";

interface CodeBlockProps {
  code: string;
  language?: string;
  theme?: "atomOneDark" | "atomOneLight";
}

export function CodeBlock({ code, language }: CodeBlockProps): React.JSX.Element {
  const { t } = useTranslation();
  useSettingsStore(); // keep store dependency for future theme switching

  const handleCopy = () => {
    Clipboard.setString(code);
  };

  // NOTE: react-native-code-highlighter is listed as a dependency and can be
  // wired in here once its React Native rendering is verified in this project.
  // For now we render a lightweight, scrollable code block to avoid web-only
  // DOM dependencies at bundle time.
  return (
    <View style={localStyles.container}>
      <View style={localStyles.header}>
        <Text style={localStyles.language}>{language || "text"}</Text>
        <TouchableOpacity
          onPress={handleCopy}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("common.copy")}
        >
          <Text style={localStyles.copy}>{t("common.copy")}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal contentContainerStyle={localStyles.highlighter}>
        <Text style={localStyles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#282c34",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#21252b",
  },
  language: {
    color: "#c8ccd4",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  copy: {
    color: "#e5e5e5",
    fontSize: 12,
    fontWeight: "500",
  },
  highlighter: {
    padding: 12,
  },
  codeText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "monospace",
    color: "#abb2bf",
  },
});
