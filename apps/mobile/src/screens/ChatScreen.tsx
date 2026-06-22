import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useGatewayStore, useSessionStore } from "../stores";
import { useAcpClient } from "../acp/hooks";
import { useLoading } from "../hooks/useLoading";
import { ChatMessage } from "../components/ChatMessage";
import { StreamingText } from "../components/StreamingText";
import { Loading } from "../components/Loading";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { Gateway, JsonRpcMessage, Message } from "../types";

type ChatRoute = RouteProp<RootStackParamList, "Chat">;

export function ChatScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const route = useRoute<ChatRoute>();
  const { sessionId } = route.params;
  const insets = useSafeAreaInsets();
  const { showLoading, hideLoading, withLoading } = useLoading();

  const session = useSessionStore((state: { sessions: Array<{ id: string; gatewayId: string }> }) =>
    state.sessions.find((s) => s.id === sessionId),
  );
  const messages = useSessionStore((state: { getSessionMessages: (id: string) => Message[] }) =>
    state.getSessionMessages(sessionId),
  );
  const { addMessage, appendToMessage } = useSessionStore();

  const gateway = useGatewayStore((state: { gateways: Gateway[] }) =>
    state.gateways.find((g) => g.id === session?.gatewayId),
  );

  const [input, setInput] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const { client, connected, state: connectionState, connect } = useAcpClient({
    gateway: gateway ?? null,
    autoConnect: true,
  });

  const isConnecting = !connected && !!gateway;

  useEffect(() => {
    if (!gateway) {
      Alert.alert(t("chat.gatewayNotFoundTitle"), t("chat.gatewayNotFoundMessage"));
    }
  }, [gateway, t]);

  // Tie the global loading overlay to the connection lifecycle. This picks up
  // the loading that SessionListScreen started and keeps it visible until the
  // gateway is reachable. The cleanup also ensures the overlay is hidden when
  // the screen unmounts.
  useEffect(() => {
    if (isConnecting) {
      showLoading(t("chat.connectingMessage"));
    }
    return () => {
      hideLoading();
    };
  }, [isConnecting, showLoading, hideLoading, t]);

  useEffect(() => {
    const unsubscribe = client?.onNotification((message: JsonRpcMessage) => {
      // ACP streaming convention: server sends incremental content as
      // notifications with method `$/content` or similar. Adapt to your agent.
      if ("method" in message && message.method === "$/content" && "params" in message) {
        const params = message.params as { delta?: string };
        if (params.delta) {
          appendToMessage(streamingId!, params.delta);
        }
      }
    });
    return () => unsubscribe?.();
  }, [client, streamingId, appendToMessage]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !client || !connected || sending) return;

    const userText = input.trim();
    setInput("");
    addMessage(sessionId, "user", userText);

    // Create a placeholder assistant message that will be streamed into.
    const assistantMessage = addMessage(sessionId, "assistant", "");
    setStreamingId(assistantMessage.id);
    setSending(true);

    try {
      // Show global loading while waiting for the agent's first response.
      const result = await withLoading(
        () => client.request<string, { content?: string }>("$/prompt", userText),
        t("chat.sending"),
      );
      if (result?.content) {
        appendToMessage(assistantMessage.id, result.content);
      }
    } catch (error) {
      appendToMessage(
        assistantMessage.id,
        t("chat.errorPrefix", { message: error instanceof Error ? error.message : String(error) }),
      );
    } finally {
      setStreamingId(null);
      setSending(false);
    }
  }, [input, client, connected, sending, sessionId, addMessage, appendToMessage, t, withLoading]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      if (item.id === streamingId && item.content === "") {
        return (
          <View style={localStyles.assistantRow}>
            <StreamingText content="▋" />
          </View>
        );
      }
      if (item.id === streamingId) {
        return (
          <View style={localStyles.assistantRow}>
            <StreamingText content={item.content} />
          </View>
        );
      }
      return <ChatMessage message={item} />;
    },
    [streamingId],
  );

  return (
    <KeyboardAvoidingView
      style={localStyles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 64}
    >
      <View style={localStyles.statusBar}>
        <Text style={localStyles.statusText}>{connectionState}</Text>
        {!connected && (
          <TouchableOpacity onPress={connect}>
            <Text style={localStyles.reconnect}>{t("chat.reconnect")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={localStyles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={localStyles.inputRow}>
        <TextInput
          style={localStyles.input}
          placeholder={t("chat.messagePlaceholder")}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={4000}
        />
        <TouchableOpacity
          style={[
            localStyles.sendButton,
            (!input.trim() || !connected || sending) && localStyles.sendDisabled,
          ]}
          onPress={handleSend}
          disabled={!input.trim() || !connected || sending}
        >
          {sending ? (
            <Loading variant="inline" size="small" color="#fff" />
          ) : (
            <Text style={localStyles.sendButtonText}>{t("chat.send")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  statusText: {
    fontSize: 12,
    color: "#666",
    textTransform: "capitalize",
  },
  reconnect: {
    fontSize: 12,
    color: "#007AFF",
  },
  list: {
    paddingVertical: 8,
  },
  assistantRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "flex-start",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d1d1",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendDisabled: {
    backgroundColor: "#b3d7ff",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
