import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  type ListRenderItem,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAcpPageAdapter } from "../hooks/useAcpPageAdapter";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { useGatewayStore } from "../stores";
import type { ChatItem } from "@hermit-org/acp-hooks";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AcpClient">;

const ChatItemView = React.memo(function ChatItemView({ item }: { item: ChatItem }): React.JSX.Element {
  if (item.kind === "message") {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userContainer : styles.assistantContainer,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {isUser ? (
            <Text style={styles.userText}>{item.content}</Text>
          ) : (
            <MarkdownRenderer content={item.content} />
          )}
        </View>
      </View>
    );
  }

  if (item.kind === "thought") {
    return (
      <View style={styles.thoughtContainer}>
        <Text style={styles.thoughtLabel}>💭 Thinking</Text>
        <Text style={styles.thoughtText}>{item.content}</Text>
      </View>
    );
  }

  // tool_call
  return (
    <View style={styles.toolCallContainer}>
      <Text style={styles.toolCallTitle}>
        🔧 {item.call.title ?? item.call.kind ?? "Tool call"}
      </Text>
      <Text style={styles.toolCallStatus}>{item.call.status ?? "running"}</Text>
    </View>
  );
});

export function AcpClientScreen({ route, navigation }: Props): React.JSX.Element {
  const { gatewayId } = route.params;
  const { t } = useTranslation();
  const gateway = useGatewayStore((s) => s.gateways.find((g) => g.id === gatewayId) ?? null);
  const adapter = useAcpPageAdapter(gateway);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const renderItem: ListRenderItem<ChatItem> = useCallback(
    ({ item }) => <ChatItemView item={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ChatItem) => item.key, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen((v) => !v)}>
          <Text style={styles.headerButton}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {gateway?.name ?? t("chat.title")}
        </Text>
        <TouchableOpacity onPress={adapter.onCreateSession}>
          <Text style={styles.headerButton}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Connection status */}
      {!adapter.initialized && (
        <View style={styles.statusBar}>
          <ActivityIndicator size="small" />
          <Text style={styles.statusText}>{adapter.connectionStatus}</Text>
          {adapter.error && (
            <Text style={styles.errorText}>{adapter.error}</Text>
          )}
        </View>
      )}

      {/* Session drawer */}
      {drawerOpen && (
        <View style={styles.drawer}>
          <FlatList
            data={adapter.sessions}
            keyExtractor={(s) => s.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.sessionItem,
                  item.id === adapter.activeSessionId && styles.activeSessionItem,
                ]}
                onPress={() => {
                  adapter.onSelectSession(item.id);
                  setDrawerOpen(false);
                }}
              >
                <Text numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t("chat.noSessions")}</Text>
            }
          />
        </View>
      )}

      {/* Chat */}
      <FlatList
        style={styles.chat}
        data={adapter.chatItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={15}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t("chat.empty")}</Text>
        }
      />

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={adapter.draft}
          onChangeText={adapter.onDraftChange}
          placeholder={t("chat.inputPlaceholder")}
          multiline
          editable={adapter.initialized && !adapter.busy}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => (adapter.busy ? adapter.onCancel() : adapter.onPrompt(adapter.draft))}
          disabled={!adapter.busy && !adapter.draft.trim()}
        >
          <Text style={styles.sendButtonText}>
            {adapter.busy ? t("chat.stop") : t("chat.send")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerButton: {
    fontSize: 22,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 8,
    backgroundColor: "#f8f8f8",
  },
  statusText: {
    fontSize: 13,
    color: "#666",
    textTransform: "capitalize",
  },
  errorText: {
    fontSize: 12,
    color: "#c00",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 50,
    bottom: 0,
    width: 260,
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: "#e5e5e5",
    zIndex: 10,
    paddingTop: 8,
  },
  sessionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  activeSessionItem: {
    backgroundColor: "#e6f2ff",
  },
  chat: {
    flex: 1,
  },
  messageContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "90%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: "#007AFF",
  },
  assistantBubble: {
    backgroundColor: "#f0f0f0",
  },
  userText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
  },
  thoughtContainer: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 10,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#aaa",
  },
  thoughtLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  thoughtText: {
    fontSize: 14,
    color: "#555",
  },
  toolCallContainer: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 10,
    backgroundColor: "#fff8e6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffe4b3",
  },
  toolCallTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  toolCallStatus: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 32,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  sendButton: {
    marginLeft: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 20,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
