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
  Alert,
  type ListRenderItem,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAcpPageAdapter } from "../hooks/useAcpPageAdapter";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { PermissionPanel } from "../components/PermissionPanel";
import { PlanBar } from "../components/PlanBar";
import { UsageBar } from "../components/UsageBar";
import { ModeSelector } from "../components/ModeSelector";
import { ConfigBar } from "../components/ConfigBar";
import { useFeatureFlag } from "../components/FeatureGate";
import { useGatewayStore, useSettingsStore } from "../stores";
import type { ChatItem, SessionSummary } from "@hermit-org/acp-hooks";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AcpClient">;

function ChatItemView({ item }: { item: ChatItem }): React.JSX.Element {
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
    return <ThoughtView content={item.content} streaming={item.streaming} />;
  }

  // tool_call
  const call = item.call;
  return (
    <View style={styles.toolCallContainer}>
      <Text style={styles.toolCallTitle}>
        🔧 {call.title ?? call.kind ?? "Tool call"}
      </Text>
      <Text style={styles.toolCallStatus}>{call.status ?? "running"}</Text>
      {call.locations.length > 0 ? (
        <Text style={styles.toolCallLocation} numberOfLines={1}>
          {call.locations.map((l) => l.path).join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

function ThoughtView({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}): React.JSX.Element {
  const thoughtPreviewLines = useSettingsStore((s) => s.thoughtPreviewLines);
  const [expanded, setExpanded] = useState(thoughtPreviewLines === 0);

  const lines = content.split("\n");
  const shouldTruncate = !expanded && thoughtPreviewLines > 0 && lines.length > thoughtPreviewLines;
  const displayContent = shouldTruncate
    ? lines.slice(0, thoughtPreviewLines).join("\n") + "…"
    : content;

  return (
    <View style={styles.thoughtContainer}>
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        style={styles.thoughtHeader}
      >
        <Text style={styles.thoughtLabel}>
          {expanded ? "▾" : "▸"} 💭 Thinking
          {streaming ? "…" : ""}
        </Text>
      </TouchableOpacity>
      <Text style={styles.thoughtText}>{displayContent}</Text>
    </View>
  );
}

function SessionItem({
  item,
  isActive,
  onSelect,
  onArchive,
  onDelete,
  onUnarchive,
  isArchived,
}: {
  item: SessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onUnarchive: () => void;
  isArchived: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();

  const handleLongPress = () => {
    const buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "destructive" | "cancel";
    }> = isArchived
      ? [
          { text: t("sessionItem.unarchive"), onPress: onUnarchive },
          { text: t("common.delete"), onPress: onDelete, style: "destructive" as const },
          { text: t("common.cancel"), style: "cancel" as const },
        ]
      : [
          { text: t("sessionItem.archive"), onPress: onArchive },
          { text: t("common.delete"), onPress: onDelete, style: "destructive" as const },
          { text: t("common.cancel"), style: "cancel" as const },
        ];

    Alert.alert(item.title || t("sessionItem.untitled"), undefined, buttons);
  };

  return (
    <TouchableOpacity
      style={[
        styles.sessionItem,
        isActive && styles.activeSessionItem,
      ]}
      onPress={onSelect}
      onLongPress={handleLongPress}
    >
      <Text
        style={[
          styles.sessionItemText,
          isActive && styles.activeSessionItemText,
        ]}
        numberOfLines={1}
      >
        {item.title || t("sessionItem.untitled")}
      </Text>
      {item.updatedAt ? (
        <Text style={styles.sessionItemTime}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export function AcpClientScreen({ route }: Props): React.JSX.Element {
  const { gatewayId } = route.params;
  const { t } = useTranslation();
  const gateway = useGatewayStore(
    (s) => s.gateways.find((g) => g.id === gatewayId) ?? null,
  );
  const adapter = useAcpPageAdapter(gateway);
  const showArchivedSessions = useSettingsStore((s) => s.showArchivedSessions);
  const showUsage = useFeatureFlag("showUsageStats");
  const showPlan = useFeatureFlag("showPlan");
  const showConfigBar = useFeatureFlag("showConfigBar");
  const showThoughts = useFeatureFlag("showThoughts");

  const [drawerOpen, setDrawerOpen] = useState(false);

  const renderItem: ListRenderItem<ChatItem> = useCallback(
    ({ item }) => {
      if (item.kind === "thought" && !showThoughts) return null;
      return <ChatItemView item={item} />;
    },
    [showThoughts],
  );

  const keyExtractor = useCallback((item: ChatItem) => item.key, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen((v) => !v)}>
          <Text style={styles.headerButton}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {gateway?.name ?? t("chat.title")}
          </Text>
          {adapter.modes.length > 0 ? (
            <ModeSelector
              modes={adapter.modes}
              currentModeId={adapter.currentModeId}
              onModeChange={adapter.onModeChange}
            />
          ) : null}
        </View>
        <TouchableOpacity onPress={adapter.onCreateSession}>
          <Text style={styles.headerButton}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Config bar */}
      {showConfigBar ? (
        <ConfigBar
          options={adapter.configOptions}
          onConfigChange={adapter.onConfigChange}
        />
      ) : null}

      {/* Connection status */}
      {!adapter.initialized && (
        <View style={styles.statusBar}>
          <ActivityIndicator size="small" />
          <Text style={styles.statusText}>{adapter.connectionStatus}</Text>
          {adapter.error ? (
            <Text style={styles.errorText}>{adapter.error}</Text>
          ) : null}
        </View>
      )}

      {/* Error banner */}
      {adapter.error && adapter.initialized ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{adapter.error}</Text>
          <TouchableOpacity onPress={adapter.onDismissError}>
            <Text style={styles.errorBannerDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Plan bar */}
      {showPlan ? <PlanBar entries={adapter.plan} /> : null}

      {/* Session drawer */}
      {drawerOpen ? (
        <TouchableOpacity
          style={styles.drawerOverlay}
          activeOpacity={1}
          onPress={() => setDrawerOpen(false)}
        >
          <View style={styles.drawer} onStartShouldSetResponder={() => true}>
            <Text style={styles.drawerTitle}>{t("session.list")}</Text>
            <FlatList
              style={styles.drawerList}
              data={adapter.sessions}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <SessionItem
                  item={item}
                  isActive={item.id === adapter.activeSessionId}
                  onSelect={() => {
                    adapter.onSelectSession(item.id);
                    setDrawerOpen(false);
                  }}
                  onArchive={() => adapter.onArchiveSession(item.id)}
                  onDelete={() => adapter.onDeleteSession(item.id)}
                  onUnarchive={() => adapter.onUnarchiveSession(item.id)}
                  isArchived={false}
                />
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>{t("chat.noSessions")}</Text>
              }
            />
            {showArchivedSessions && adapter.archivedSessions.length > 0 ? (
              <>
                <Text style={styles.drawerSectionTitle}>
                  {t("session.archived")} ({adapter.archivedSessions.length})
                </Text>
                <FlatList
                  style={styles.drawerList}
                  data={adapter.archivedSessions}
                  keyExtractor={(s) => s.id}
                  renderItem={({ item }) => (
                    <SessionItem
                      item={item}
                      isActive={false}
                      onSelect={() => {
                        adapter.onUnarchiveSession(item.id);
                        adapter.onSelectSession(item.id);
                        setDrawerOpen(false);
                      }}
                      onArchive={() => adapter.onUnarchiveSession(item.id)}
                      onDelete={() => adapter.onDeleteSession(item.id)}
                      onUnarchive={() => adapter.onUnarchiveSession(item.id)}
                      isArchived
                    />
                  )}
                />
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : null}

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

      {/* Permission panel */}
      <PermissionPanel
        requests={adapter.permissions}
        history={adapter.permissionHistory}
        onResolve={adapter.onResolvePermission}
      />

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={adapter.draft}
          onChangeText={adapter.onDraftChange}
          placeholder={t("chat.inputPlaceholder")}
          placeholderTextColor="#999"
          multiline
          editable={adapter.initialized && !adapter.busy}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!adapter.busy && !adapter.draft.trim()) && styles.sendButtonDisabled,
          ]}
          onPress={() =>
            adapter.busy ? adapter.onCancel() : adapter.onPrompt(adapter.draft)
          }
          disabled={!adapter.busy && !adapter.draft.trim()}
        >
          <Text style={styles.sendButtonText}>
            {adapter.busy ? t("chat.stop") : t("chat.send")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Usage bar */}
      {showUsage ? <UsageBar usage={adapter.usage} /> : null}
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
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#ffcccc",
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#c00",
  },
  errorBannerDismiss: {
    fontSize: 16,
    color: "#c00",
    paddingHorizontal: 8,
  },
  drawerOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
    zIndex: 20,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: "#e5e5e5",
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#333",
  },
  drawerSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    marginTop: 16,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  drawerList: {
    flex: 1,
  },
  sessionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  activeSessionItem: {
    backgroundColor: "#e6f2ff",
  },
  activeSessionItemText: {
    fontWeight: "600",
    color: "#007AFF",
  },
  sessionItemText: {
    fontSize: 14,
    color: "#333",
  },
  sessionItemTime: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 2,
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
  thoughtHeader: {
    marginBottom: 4,
  },
  thoughtLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
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
  toolCallLocation: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
    fontFamily: "monospace",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 32,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    gap: 10,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
