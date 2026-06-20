import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useGatewayStore, useSettingsStore, type AppLanguage } from "../stores";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { Gateway } from "../types";

type ServerListNavigation = NavigationProp<RootStackParamList, "ServerList">;

const languageOptions: AppLanguage[] = ["system", "en", "zh"];

export function ServerListScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<ServerListNavigation>();
  const { gateways, addGateway, updateGateway, removeGateway, setActiveGateway } =
    useGatewayStore();
  const { language, setLanguage } = useSettingsStore();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setUrl("");
    setToken("");
    setEditingId(null);
  };

  const handleSave = () => {
    if (!name.trim() || !url.trim() || !token.trim()) {
      Alert.alert(t("serverList.missingFieldsTitle"), t("serverList.missingFields"));
      return;
    }

    if (editingId) {
      updateGateway(editingId, { name: name.trim(), url: url.trim(), token: token.trim() });
    } else {
      addGateway({ name: name.trim(), url: url.trim(), token: token.trim(), sendUrl: "" });
    }
    resetForm();
  };

  const handleEdit = (gateway: Gateway) => {
    setEditingId(gateway.id);
    setName(gateway.name);
    setUrl(gateway.url);
    setToken(gateway.token);
  };

  const handleDelete = (id: string) => {
    Alert.alert(t("serverList.deleteTitle"), t("serverList.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => removeGateway(id) },
    ]);
  };

  const handleSelect = (gateway: Gateway) => {
    setActiveGateway(gateway.id);
    navigation.navigate("SessionList", { gatewayId: gateway.id });
  };

  const handleScanQr = () => {
    navigation.navigate("QrScanner");
  };

  const handleChangeLanguage = () => {
    Alert.alert(
      t("language.label"),
      undefined,
      languageOptions.map((value) => ({
        text: t(`language.${value}`),
        onPress: () => setLanguage(value),
      })),
    );
  };

  return (
    <View style={localStyles.container}>
      <View style={localStyles.headerRow}>
        <Text style={localStyles.headerTitle}>{t("serverList.title")}</Text>
        <View style={localStyles.headerActions}>
          <TouchableOpacity style={localStyles.languageButton} onPress={handleChangeLanguage}>
            <Text style={localStyles.languageButtonText}>{t(`language.${language}`)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={localStyles.scanButton} onPress={handleScanQr}>
            <Text style={localStyles.scanButtonText}>{t("serverList.scanQr")}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={localStyles.form}>
        <TextInput
          style={localStyles.input}
          placeholder={t("serverList.namePlaceholder")}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={localStyles.input}
          placeholder={t("serverList.urlPlaceholder")}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TextInput
          style={localStyles.input}
          placeholder={t("serverList.tokenPlaceholder")}
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          secureTextEntry
        />
        <TouchableOpacity style={localStyles.button} onPress={handleSave}>
          <Text style={localStyles.buttonText}>
            {t(editingId ? "serverList.updateGateway" : "serverList.addGateway")}
          </Text>
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity style={localStyles.cancelButton} onPress={resetForm}>
            <Text style={localStyles.cancelButtonText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={gateways}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={localStyles.item}>
            <TouchableOpacity style={localStyles.itemMain} onPress={() => handleSelect(item)}>
              <Text style={localStyles.itemName}>{item.name}</Text>
              <Text style={localStyles.itemUrl}>{item.url}</Text>
            </TouchableOpacity>
            <View style={localStyles.itemActions}>
              <TouchableOpacity onPress={() => handleEdit(item)}>
                <Text style={localStyles.action}>{t("common.edit")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={[localStyles.action, localStyles.deleteAction]}>{t("common.delete")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={localStyles.empty}>{t("serverList.empty")}</Text>
        }
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  languageButtonText: {
    color: "#007AFF",
    fontWeight: "600",
    fontSize: 13,
  },
  scanButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  form: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d1d1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  cancelButton: {
    marginTop: 8,
    padding: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 15,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  itemMain: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  itemUrl: {
    fontSize: 13,
    color: "#666",
  },
  itemActions: {
    flexDirection: "row",
    gap: 16,
  },
  action: {
    fontSize: 14,
    color: "#007AFF",
  },
  deleteAction: {
    color: "#ff3b30",
  },
  empty: {
    textAlign: "center",
    marginTop: 32,
    color: "#999",
  },
});
