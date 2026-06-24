import React from "react";
import { View, StyleSheet } from "react-native";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useThrottle } from "../hooks/useThrottle";

interface StreamingTextProps {
  content: string;
}

/**
 * Renders partial assistant output while it is streaming in.
 *
 * Updates are throttled so the Markdown renderer does not re-render on every
 * single character. The final content is always flushed once the stream pauses.
 */
export function StreamingText({ content }: StreamingTextProps): React.JSX.Element {
  const throttledContent = useThrottle(content, 80);
  return (
    <View style={localStyles.container}>
      <MarkdownRenderer content={throttledContent || "▋"} />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
});
