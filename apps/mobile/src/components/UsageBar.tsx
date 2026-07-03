import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { UsageStats } from "@hermit-org/acp-hooks";

export interface UsageBarProps {
  usage: UsageStats | undefined;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function UsageBar({ usage }: UsageBarProps): React.JSX.Element | null {
  if (!usage) return null;

  const parts: string[] = [];
  parts.push(`${formatTokens(usage.used)} / ${formatTokens(usage.size)}`);
  if (usage.cost) {
    parts.push(
      `$${usage.cost.amount.toFixed(usage.cost.amount < 0.01 ? 4 : 2)}`,
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{parts.join("  ·  ")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  text: {
    fontSize: 11,
    color: "#888",
  },
});
