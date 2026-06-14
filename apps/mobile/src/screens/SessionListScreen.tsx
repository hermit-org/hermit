import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { useGatewayStore, useSessionStore } from "../stores";
import type { RootStackParamList } from "../navigation/RootNavigator";

type SessionListRoute = RouteProp<RootStackParamList, "SessionList">;
type SessionListNavigation = NavigationProp<RootStackParamList, "SessionList">;

export function SessionListScreen(): React.JSX.Element {
  const route = useRoute<SessionListRoute>();
  const navigation = useNavigation<SessionListNavigation>();
  const { gatewayId } = route.params;

  const gateway = useGatewayStore((state: { gateways: Array<{ id: string; name: string }> }) =>
    state.gateways.find((g) => g.id === gatewayId),
  );
  const { sessions, createSession, deleteSession } = useSessionStore();

  const gatewaySessions = sessions
    .filter((s: { gatewayId: string }) => s.gatewayId === gatewayId)
    .sort((a: { updatedAt: number }, b: { updatedAt: number }) => b.updatedAt - a.updatedAt);

  const handleNewSession = () => {
    const session = createSession(gatewayId, "New chat");
    navigation.navigate("Chat", { sessionId: session.id });
  };

  const handleOpenSession = (sessionId: string) => {
    navigation.navigate("Chat", { sessionId });
  };

  return (
    <View style={localStyles.container}>
      <View style={localStyles.header}>
        <Text style={localStyles.title}>{gateway?.name ?? "Gateway"}</Text>
        <TouchableOpacity style={localStyles.newButton} onPress={handleNewSession}>
          <Text style={localStyles.newButtonText}>+ New Session</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={gatewaySessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={localStyles.item}
            onPress={() => handleOpenSession(item.id)}
            onLongPress={() => deleteSession(item.id)}
          >
            <Text style={localStyles.itemTitle}>{item.title}</Text>
            <Text style={localStyles.itemMeta}>
              {new Date(item.updatedAt).toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={localStyles.empty}>No sessions yet. Start a new one.</Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  newButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: "#999",
  },
  empty: {
    textAlign: "center",
    marginTop: 32,
    color: "#999",
  },
});
