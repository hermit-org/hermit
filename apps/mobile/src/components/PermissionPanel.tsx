import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import type {
  PendingPermission,
  AnsweredPermissionView,
} from "@hermit-org/acp-hooks";

export interface PermissionPanelProps {
  requests: PendingPermission[];
  history: AnsweredPermissionView[];
  onResolve: (
    request: PendingPermission,
    optionId: string,
    note?: string,
  ) => void;
}

function optionColor(kind?: string): { bg: string; text: string } {
  switch (kind) {
    case "allow_once":
    case "allow_always":
      return { bg: "#16a34a", text: "#fff" };
    case "reject_once":
    case "reject_always":
      return { bg: "#dc2626", text: "#fff" };
    default:
      return { bg: "#007AFF", text: "#fff" };
  }
}

export function PermissionPanel({
  requests,
  history,
  onResolve,
}: PermissionPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);

  if (requests.length === 0 && history.length === 0) return null;

  return (
    <View style={styles.container}>
      {requests.map((req, i) => {
        const tc = req.toolCall;
        const title = tc.title ?? req.id;
        const noteValue = notes[req.id] ?? "";

        const handleResolve = (optionId: string) => {
          const note = noteValue.trim() || undefined;
          if (note) {
            setNotes((prev) => {
              const next = { ...prev };
              delete next[req.id];
              return next;
            });
          }
          onResolve(req, optionId, note);
        };

        return (
          <View key={req.id} style={styles.card}>
            {requests.length > 1 ? (
              <Text style={styles.badge}>
                {t("permission.questionBadge", { n: i + 1 })}
              </Text>
            ) : null}
            <Text style={styles.question}>{title}</Text>
            <View style={styles.options}>
              {req.options.map((opt) => {
                const colors = optionColor(opt.kind);
                return (
                  <TouchableOpacity
                    key={opt.optionId}
                    style={[styles.optionBtn, { backgroundColor: colors.bg }]}
                    onPress={() => handleResolve(opt.optionId)}
                  >
                    <Text style={[styles.optionText, { color: colors.text }]}>
                      {opt.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder={t("permission.notePlaceholder")}
              placeholderTextColor="#999"
              value={noteValue}
              onChangeText={(v) =>
                setNotes((prev) => ({ ...prev, [req.id]: v }))
              }
            />
          </View>
        );
      })}

      {history.length > 0 ? (
        <View style={styles.historySection}>
          <TouchableOpacity
            onPress={() => setShowHistory((s) => !s)}
            style={styles.historyToggle}
          >
            <Text style={styles.historyToggleText}>
              {t("chat.answeredHistory", { count: history.length })}
            </Text>
          </TouchableOpacity>
          {showHistory
            ? history.map((h) => (
                <View
                  key={`${h.id}-${h.at}`}
                  style={styles.historyItem}
                >
                  <Text style={styles.historyQuestion} numberOfLines={2}>
                    {h.question}
                  </Text>
                  <View
                    style={[
                      styles.historyBubble,
                      h.cancelled
                        ? styles.historyCancelled
                        : styles.historyAnswered,
                    ]}
                  >
                    <Text style={styles.historyAnswerText}>
                      {h.cancelled
                        ? t("permission.skipped")
                        : h.answer}
                    </Text>
                    {h.note ? (
                      <Text style={styles.historyNote}>{h.note}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 6,
    gap: 6,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#888",
    marginBottom: 4,
  },
  question: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    lineHeight: 20,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  optionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    backgroundColor: "#fafafa",
  },
  historySection: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 6,
  },
  historyToggle: {
    paddingVertical: 4,
  },
  historyToggleText: {
    fontSize: 12,
    color: "#666",
  },
  historyItem: {
    alignItems: "flex-end",
    marginTop: 6,
  },
  historyQuestion: {
    fontSize: 11,
    color: "#888",
    maxWidth: "85%",
    marginBottom: 2,
  },
  historyBubble: {
    maxWidth: "85%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderBottomRightRadius: 4,
  },
  historyAnswered: {
    backgroundColor: "#007AFF",
  },
  historyCancelled: {
    backgroundColor: "#e0e0e0",
  },
  historyAnswerText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
  },
  historyNote: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontStyle: "italic",
    marginTop: 2,
  },
});
