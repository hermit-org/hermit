import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { useTranslation } from "react-i18next";

interface CodeBlockProps {
  code: string;
  language?: string;
  theme?: "atomOneDark" | "atomOneLight";
}

export function CodeBlock({ code, language }: CodeBlockProps): React.JSX.Element {
  const { t } = useTranslation();

  const handleCopy = () => {
    Clipboard.setString(code);
  };

  return (
    <View style={localStyles.container}>
      <View style={localStyles.header}>
        <Text style={localStyles.language}>{language || "text"}</Text>
        <TouchableOpacity onPress={handleCopy}>
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
    color: "#abb2bf",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  copy: {
    color: "#61afef",
    fontSize: 12,
  },
  highlighter: {
    padding: 12,
  },
  codeText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "monospace",
  },
});
