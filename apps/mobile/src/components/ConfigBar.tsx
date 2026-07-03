import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import type { ConfigOption } from "@hermit-org/acp";

export interface ConfigBarProps {
  options: ConfigOption[];
  onConfigChange: (optionId: string, value: string) => void;
}

function nextValue(option: ConfigOption): string | null {
  if (option.type === "toggle") {
    return option.currentValue === "true" ? "false" : "true";
  }
  if (option.options && option.options.length > 0) {
    const currentIndex = option.options.findIndex(
      (o) => o.value === option.currentValue,
    );
    const nextIndex = (currentIndex + 1) % option.options.length;
    return option.options[nextIndex].value;
  }
  return null;
}

function displayValue(option: ConfigOption): string {
  if (option.type === "toggle") {
    return option.currentValue === "true" ? "✓" : "✗";
  }
  const current = option.options?.find(
    (o) => o.value === option.currentValue,
  );
  return current?.name ?? current?.value ?? option.currentValue;
}

export function ConfigBar({
  options,
  onConfigChange,
}: ConfigBarProps): React.JSX.Element | null {
  if (!options || options.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {options.map((opt) => {
          const value = displayValue(opt);
          const isActive =
            opt.type === "toggle"
              ? opt.currentValue === "true"
              : true;

          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.chip,
                isActive ? styles.chipActive : styles.chipInactive,
              ]}
              onPress={() => {
                const next = nextValue(opt);
                if (next !== null) onConfigChange(opt.id, next);
              }}
            >
              <Text
                style={[
                  styles.chipLabel,
                  isActive
                    ? styles.chipLabelActive
                    : styles.chipLabelInactive,
                ]}
              >
                {opt.name}
              </Text>
              <Text
                style={[
                  styles.chipValue,
                  isActive
                    ? styles.chipValueActive
                    : styles.chipValueInactive,
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  chipInactive: {
    backgroundColor: "#f0f0f0",
    borderColor: "#ddd",
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: "rgba(255,255,255,0.8)",
  },
  chipLabelInactive: {
    color: "#666",
  },
  chipValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  chipValueActive: {
    color: "#fff",
  },
  chipValueInactive: {
    color: "#333",
  },
});
