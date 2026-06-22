import React from "react";
import {
  Modal,
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
} from "react-native";
import { useLoadingStore } from "../stores/loadingStore";

/**
 * Global loading overlay rendered at the app root.
 *
 * Controlled via the `useLoading` hook — no props needed.
 * Uses a transparent Modal so it always sits above every screen.
 */
export function GlobalLoading(): React.JSX.Element | null {
  const visible = useLoadingStore((s) => s.visible);
  const text = useLoadingStore((s) => s.text);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#007AFF" />
          {text ? <Text style={styles.text}>{text}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  card: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    gap: 14,
    minWidth: 120,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  text: {
    fontSize: 15,
    color: "#333",
    textAlign: "center",
  },
});
