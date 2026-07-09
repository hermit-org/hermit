import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useGatewayStore } from "../stores";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "GatewayManager">;

export function GatewayManagerScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useGatewayStore((s) => s.gateways);
  const addGateway = useGatewayStore((s) => s.addGateway);
  const removeGateway = useGatewayStore((s) => s.removeGateway);
  const activeGatewayId = useGatewayStore((s) => s.activeGatewayId);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  // Auto-navigate to AcpClient if there's an active gateway
  useEffect(() => {
    if (activeGatewayId && gateways.length > 0) {
      navigation.navigate("AcpClient", { gatewayId: activeGatewayId });
    }
  }, [activeGatewayId, gateways, navigation]);

  const handleAdd = () => {
    const trimmedUrl = url.trim();
    const trimmedName = name.trim();
    if (!trimmedUrl) {
      Alert.alert(t("gateways.error"), t("gateways.urlRequired"));
      return;
    }
    addGateway({
      name: trimmedName || trimmedUrl,
      url: trimmedUrl,
      sendUrl: "",
      token: token.trim(),
    });
    setName("");
    setUrl("");
    setToken("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t("gateways.title")}</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={t("gateways.namePlaceholder")}
          value={name}
          onChangeText={setName}
          accessibilityLabel={t("gateways.namePlaceholder")}
        />
        <TextInput
          style={styles.input}
          placeholder={t("gateways.urlPlaceholder")}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          accessibilityLabel={t("gateways.urlPlaceholder")}
        />
        <TextInput
          style={styles.input}
          placeholder={t("gateways.tokenPlaceholder")}
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          secureTextEntry
          accessibilityLabel={t("gateways.tokenPlaceholder")}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAdd}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("gateways.add")}
        >
          <Text style={styles.addButtonText}>{t("gateways.add")}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={gateways}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.gatewayItem}>
            <View style={styles.gatewayInfo}>
              <Text style={styles.gatewayName}>{item.name}</Text>
              <Text style={styles.gatewayUrl}>{item.url}</Text>
            </View>
            <View style={styles.gatewayActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate("AcpClient", { gatewayId: item.id })}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t("gateways.connect") + " " + item.name}
              >
                <Text style={styles.actionText}>{t("gateways.connect")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => removeGateway(item.id)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t("gateways.delete") + " " + item.name}
              >
                <Text style={styles.actionText}>{t("gateways.delete")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t("gateways.empty")}</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  form: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 44,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  gatewayItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  gatewayInfo: {
    flex: 1,
    marginRight: 12,
  },
  gatewayName: {
    fontSize: 16,
    fontWeight: "600",
  },
  gatewayUrl: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  gatewayActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#007AFF",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  deleteButton: {
    backgroundColor: "#ff3b30",
  },
  actionText: {
    color: "#fff",
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    marginTop: 32,
  },
});
