import React from "react";
import Markdown, { type RenderRules } from "react-native-markdown-display";
import { StyleSheet, Text, View } from "react-native";
import { CodeBlock } from "./CodeBlock";
import { useSettingsStore } from "../stores";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps): React.JSX.Element {
  const { codeTheme } = useSettingsStore();

  const rules: RenderRules = {
    code_block: (node) => {
      const language = (node as unknown as { sourceInfo?: string }).sourceInfo ?? "";
      return (
        <CodeBlock
          key={node.key}
          code={node.content}
          language={language}
          theme={codeTheme}
        />
      );
    },
    fence: (node) => {
      const language = (node as unknown as { sourceInfo?: string }).sourceInfo ?? "";
      return (
        <CodeBlock
          key={node.key}
          code={node.content}
          language={language}
          theme={codeTheme}
        />
      );
    },
    inline_code: (node, _children, _parent, styles) => (
      <Text key={node.key} style={[styles.inline_code, localStyles.inlineCode]}>
        {node.content}
      </Text>
    ),
  };

  return (
    <View style={localStyles.container}>
      <Markdown style={markdownStyles} rules={rules}>
        {content}
      </Markdown>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  inlineCode: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: "monospace",
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    color: "#1a1a1a",
    fontSize: 16,
    lineHeight: 22,
  },
  heading1: { fontSize: 24, fontWeight: "bold", marginVertical: 8 },
  heading2: { fontSize: 20, fontWeight: "bold", marginVertical: 6 },
  heading3: { fontSize: 18, fontWeight: "bold", marginVertical: 4 },
  paragraph: { marginVertical: 4 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  strong: { fontWeight: "bold" },
  em: { fontStyle: "italic" },
});
