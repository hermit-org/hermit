import React from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { Message } from "../types";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps): React.JSX.Element {
  const isUser = message.role === "user";

  return (
    <div style={{ ...styles.row, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          ...styles.bubble,
          ...(isUser ? styles.userBubble : styles.assistantBubble),
        }}
      >
        {isUser ? (
          <span style={styles.userText}>{message.content}</span>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    padding: "6px 12px",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: "16px",
    padding: "10px 14px",
    wordBreak: "break-word",
  },
  userBubble: {
    backgroundColor: "#007AFF",
  },
  assistantBubble: {
    backgroundColor: "#f0f0f0",
  },
  userText: {
    color: "#fff",
    fontSize: "15px",
    lineHeight: "22px",
    whiteSpace: "pre-wrap",
  },
};
