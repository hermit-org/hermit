import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import type { SessionMode } from "@hermit-org/acp-hooks";

export interface ModeSelectorProps {
  modes: SessionMode[];
  currentModeId?: string;
  onModeChange: (modeId: string) => void;
}

export function ModeSelector({
  modes,
  currentModeId,
  onModeChange,
}: ModeSelectorProps): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);

  if (!modes || modes.length === 0) return null;

  const current =
    modes.find((m) => m.id === currentModeId) ?? modes[0];

  const handleSelect = (modeId: string) => {
    onModeChange(modeId);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {current.name}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.dropdown}>
            <FlatList
              data={modes}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.id === currentModeId && styles.optionActive,
                  ]}
                  onPress={() => handleSelect(item.id)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.id === currentModeId && styles.optionTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text style={styles.optionDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    maxWidth: 120,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  chevron: {
    fontSize: 10,
    color: "#666",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  dropdown: {
    width: "70%",
    maxHeight: 300,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  optionActive: {
    backgroundColor: "#e6f2ff",
  },
  optionText: {
    fontSize: 15,
    color: "#333",
  },
  optionTextActive: {
    fontWeight: "600",
    color: "#007AFF",
  },
  optionDesc: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
});
