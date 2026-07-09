import React from "react";
import { View, ActivityIndicator, StyleSheet, type ViewStyle } from "react-native";

interface LoadingProps {
  /** Overlay fills the parent (parent must be positioned). Inline renders just the spinner. */
  variant?: "inline" | "overlay";
  size?: "small" | "large";
  color?: string;
  style?: ViewStyle;
}

/**
 * Lightweight loading indicator.
 *
 * - `inline`: renders a bare spinner (use inside buttons, list footers, etc.)
 * - `overlay`: absolute-fill semi-transparent backdrop with centered spinner
 *   — place inside a positioned parent.
 */
export function Loading({
  variant = "inline",
  size = "small",
  color = "#007AFF",
  style,
}: LoadingProps): React.JSX.Element {
  if (variant === "inline") {
    return (
      <View style={[localStyles.inline, style]} testID="loading-inline">
        <ActivityIndicator size={size} color={color} accessibilityLabel="Loading" />
      </View>
    );
  }

  return (
    <View style={[localStyles.overlay, style]} testID="loading-overlay">
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const localStyles = StyleSheet.create({
  inline: {
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
});
