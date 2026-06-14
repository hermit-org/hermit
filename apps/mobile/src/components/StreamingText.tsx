import React from "react";
import { View, StyleSheet } from "react-native";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface StreamingTextProps {
  content: string;
}

/**
 * Renders partial assistant output while it is streaming in.
 *
 * For a true streaming Markdown experience the renderer must tolerate
 * incomplete syntax. `react-native-markdown-display` re-renders on each
 * update; for long streams this can be optimised with memoization or by
 * buffering updates with a short throttle.
 */
export function StreamingText({ content }: StreamingTextProps): React.JSX.Element {
  return (
    <View style={localStyles.container}>
      <MarkdownRenderer content={content || "▋"} />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
});
