import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { PlanEntry, PlanStatus } from "@hermit-org/acp-hooks";

export interface PlanBarProps {
  entries: PlanEntry[];
}

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_ICON: Record<PlanStatus, string> = {
  pending: "○",
  in_progress: "◐",
  completed: "●",
};

const STATUS_COLOR: Record<PlanStatus, string> = {
  pending: "#999",
  in_progress: "#f59e0b",
  completed: "#16a34a",
};

export function PlanBar({ entries }: PlanBarProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!entries || entries.length === 0) return null;

  const completed = entries.filter((e) => e.status === "completed").length;
  const total = entries.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text style={styles.expandIcon}>{expanded ? "▾" : "▸"}</Text>
        <Text style={styles.title}>{t("plan.title")}</Text>
        <Text style={styles.count}>
          {completed}/{total}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.list}>
          {entries.map((entry, i) => {
            const status = entry.status ?? "pending";
            return (
              <View key={i} style={styles.item}>
                <Text
                  style={[
                    styles.itemIcon,
                    { color: STATUS_COLOR[status] },
                  ]}
                >
                  {STATUS_ICON[status]}
                </Text>
                <Text
                  style={[
                    styles.itemText,
                    status === "completed" && styles.itemCompleted,
                  ]}
                  numberOfLines={2}
                >
                  {entry.content}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  expandIcon: {
    fontSize: 12,
    color: "#666",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  count: {
    fontSize: 12,
    color: "#888",
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    marginLeft: 4,
  },
  progressFill: {
    height: 4,
    backgroundColor: "#16a34a",
    borderRadius: 2,
  },
  list: {
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  itemIcon: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#333",
  },
  itemCompleted: {
    textDecorationLine: "line-through",
    color: "#999",
  },
});
