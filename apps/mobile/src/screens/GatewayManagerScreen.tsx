import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Alert,
  type ListRenderItem,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useGatewayStore } from "../stores";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { Gateway } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "GatewayManager">;

export function GatewayManagerScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useGatewayStore((s) => s.gateways);
  const addGateway = useGatewayStore((s) => s.addGateway);
  const removeGateway = useGatewayStore((s) => s.removeGateway);
  const updateGateway = useGatewayStore((s) => s.updateGateway);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmedUrl = url.trim();
    const trimmedName = name.trim();
    if (!trimmedUrl) {
      Alert.alert(t("gateways.error"), t("gateways.urlRequired"));
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      Alert.alert(t("gateways.error"), t("gateways.urlInvalid"));
      return;
    }
    try {
      if (editingId) {
        updateGateway(editingId, {
          name: trimmedName || trimmedUrl,
          url: trimmedUrl,
          token: token.trim(),
        });
        setEditingId(null);
      } else {
        addGateway({
          name: trimmedName || trimmedUrl,
          url: trimmedUrl,
          sendUrl: "",
          token: token.trim(),
        });
      }
      setName("");
      setUrl("");
      setToken("");
    } catch (e) {
      console.error("[GatewayManager] failed to save gateway:", e);
      Alert.alert(
        t("gateways.error"),
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const handleEdit = (item: Gateway) => {
    setEditingId(item.id);
    setName(item.name);
    setUrl(item.url);
    setToken(item.token);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setUrl("");
    setToken("");
  };

  const renderItem: ListRenderItem<Gateway> = useCallback(
    ({ item }) => (
      <View style={styles.gatewayItem}>
        <TouchableOpacity
          style={styles.gatewayInfo}
          onPress={() => navigation.navigate("AcpClient", { gatewayId: item.id })}
          onLongPress={() => handleEdit(item)}
        >
          <Text style={styles.gatewayName}>{item.name}</Text>
          <Text style={styles.gatewayUrl}>{item.url}</Text>
        </TouchableOpacity>
        <View style={styles.gatewayActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("AcpClient", { gatewayId: item.id })}
          >
            <Text style={styles.actionText}>{t("gateways.connect")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => removeGateway(item.id)}
          >
            <Text style={styles.actionText}>{t("gateways.delete")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [navigation, t, removeGateway, updateGateway],
  );

  const keyExtractor = useCallback((item: Gateway) => item.id, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with settings + QR scan buttons */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => navigation.navigate("QrScanner")}
        >
          <Text style={styles.topBarIcon}>⌗</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("gateways.title")}</Text>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => navigation.navigate("Settings")}
        >
          <Text style={styles.topBarIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={t("gateways.namePlaceholder")}
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder={t("gateways.urlPlaceholder")}
          placeholderTextColor="#999"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TextInput
          style={styles.input}
          placeholder={t("gateways.tokenPlaceholder")}
          placeholderTextColor="#999"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          secureTextEntry
        />
        <View style={styles.formActions}>
          <TouchableOpacity
            style={[styles.addButton, { flex: 1 }]}
            onPress={handleAdd}
          >
            <Text style={styles.addButtonText}>
              {editingId ? t("common.save") : t("gateways.add")}
            </Text>
          </TouchableOpacity>
          {editingId ? (
            <TouchableOpacity
              style={[styles.addButton, styles.cancelEditButton, { flex: 1 }]}
              onPress={handleCancelEdit}
            >
              <Text style={styles.cancelEditText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={gateways}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  topBarButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarIcon: {
    fontSize: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
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
    paddingVertical: 12,
    alignItems: "center",
  },
  formActions: {
    flexDirection: "row",
    gap: 8,
  },
  cancelEditButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelEditText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 16,
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
    paddingVertical: 6,
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
    color: "#999",
    marginTop: 32,
  },
});
