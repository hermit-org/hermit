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

function ThoughtItemView({
  item,
}: {
  item: Extract<ChatItem, { kind: "thought" }>;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setExpanded((v) => !v)}
      style={styles.toolCallContainer}
    >
      <View style={styles.thoughtHeader}>
        <Text style={styles.toolCallTitle}>{t("chat.thinking")}</Text>
        {item.streaming ? (
          <Text style={styles.toolCallStatus}>{t("chat.toolCallRunning")}</Text>
        ) : null}
      </View>
      {expanded ? <Text style={styles.thoughtText}>{item.content}</Text> : null}
    </TouchableOpacity>
  );
}

function ChatItemView({ item }: { item: ChatItem }): React.JSX.Element {
  const { t } = useTranslation();

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
    return <ThoughtItemView item={item} />;
  }

  if (item.kind === "divider") {
    return (
      <View style={styles.dividerContainer}>
        <Text style={styles.dividerText}>— {item.label} —</Text>
      </View>
    );
  }

  if (item.kind === "divider") {
    return (
      <View style={styles.dividerContainer}>
        <Text style={styles.dividerText}>— {item.label} —</Text>
      </View>
    );
  }

  // tool_call
  return (
    <View style={styles.toolCallContainer}>
      <Text style={styles.toolCallTitle}>
        {t("chat.toolCall", { title: item.call.title ?? item.call.kind ?? t("chat.toolCallFallback") })}
      </Text>
      <Text style={styles.toolCallStatus}>
        {item.call.status ?? t("chat.toolCallRunning")}
      </Text>
    </View>
  );
}

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
        <TouchableOpacity
          onPress={() => setDrawerOpen((v) => !v)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("common.menu")}
        >
          <Text style={styles.headerButton}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {gateway?.name ?? t("chat.title")}
        </Text>
        <TouchableOpacity
          onPress={adapter.onCreateSession}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("common.newSession")}
        >
          <Text style={styles.headerButton}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Connection status */}
      {!adapter.initialized && (
        <View style={styles.statusBar}>
          <ActivityIndicator size="small" accessibilityLabel={t("common.connecting")} />
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
                accessible
                accessibilityRole="button"
                accessibilityLabel={item.title}
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
          accessibilityLabel={t("chat.inputPlaceholder")}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => (adapter.busy ? adapter.onCancel() : adapter.onPrompt(adapter.draft))}
          disabled={!adapter.busy && !adapter.draft.trim()}
          accessible
          accessibilityRole="button"
          accessibilityLabel={adapter.busy ? t("chat.stop") : t("chat.send")}
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 44,
    minHeight: 44,
    textAlign: "center",
    textAlignVertical: "center",
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
    paddingVertical: 14,
    minHeight: 44,
    justifyContent: "center",
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
  thoughtHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  thoughtText: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
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
  dividerContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  dividerText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  dividerContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  dividerText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
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
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
