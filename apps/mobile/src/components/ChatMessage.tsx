import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { Message } from "../types";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps): React.JSX.Element {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        localStyles.container,
        isUser ? localStyles.userContainer : localStyles.assistantContainer,
      ]}
    >
      <View
        style={[
          localStyles.bubble,
          isUser ? localStyles.userBubble : localStyles.assistantBubble,
        ]}
      >
        {isUser ? (
          <Text style={localStyles.userText}>{message.content}</Text>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "90%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: "#007AFF",
  },
  assistantBubble: {
    backgroundColor: "#f0f0f0",
  },
  userText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
  },
});
