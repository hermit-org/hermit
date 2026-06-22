import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Session, Message, MessageRole } from "../types";
import type { ConfigOption } from "@hermit-org/acp";

interface SessionState {
  sessions: Session[];
  messages: Message[];
  activeSessionId: string | null;
  createSession: (
    gatewayId: string,
    title?: string,
    acpSessionId?: string,
  ) => Session;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  /** Persist the agent-side ACP session ID so it can be resumed later. */
  setSessionAcpId: (id: string, acpSessionId: string) => void;
  /** Persist config options so status chips survive a reopen. */
  setSessionConfig: (id: string, configOptions: ConfigOption[]) => void;
  /** Update a session's title (e.g. from `session_info_update`). */
  setSessionTitle: (id: string, title: string) => void;
  /** Mark whether the agent-side session has been closed. */
  setSessionClosed: (id: string, closed: boolean) => void;
  addMessage: (sessionId: string, role: MessageRole, content: string) => Message;
  /** Replace a session's entire message history (used after `session/load`,
   * where the agent's replayed history is authoritative). */
  setMessages: (sessionId: string, messages: { role: MessageRole; content: string }[]) => void;
  appendToMessage: (messageId: string, delta: string) => void;
  getSessionMessages: (sessionId: string) => Message[];
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      messages: [],
      activeSessionId: null,

      createSession(gatewayId, title, acpSessionId) {
        const now = Date.now();
        const session: Session = {
          id: generateId("sess"),
          gatewayId,
          title: title ?? "New session",
          createdAt: now,
          updatedAt: now,
          ...(acpSessionId ? { acpSessionId } : {}),
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
        }));
        return session;
      },

      deleteSession(id) {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          messages: state.messages.filter((m) => m.sessionId !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        }));
      },

      setActiveSession(id) {
        set({ activeSessionId: id });
      },

      setSessionAcpId(id, acpSessionId) {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, acpSessionId, updatedAt: Date.now() } : s,
          ),
        }));
      },

      setSessionConfig(id, configOptions) {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, configOptions } : s,
          ),
        }));
      },

      setSessionTitle(id, title) {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title: trimmed, updatedAt: Date.now() } : s,
          ),
        }));
      },

      setSessionClosed(id, closed) {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, closed, updatedAt: Date.now() } : s,
          ),
        }));
      },

      addMessage(sessionId, role, content) {
        const message: Message = {
          id: generateId("msg"),
          sessionId,
          role,
          content,
          createdAt: Date.now(),
        };
        set((state) => ({
          messages: [...state.messages, message],
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, updatedAt: Date.now() } : s,
          ),
        }));
        return message;
      },

      setMessages(sessionId, history) {
        const now = Date.now();
        const rebuilt: Message[] = history.map((m, i) => ({
          id: generateId("msg"),
          sessionId,
          role: m.role,
          content: m.content,
          createdAt: now + i,
        }));
        set((state) => ({
          messages: [
            ...state.messages.filter((m) => m.sessionId !== sessionId),
            ...rebuilt,
          ],
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, updatedAt: now } : s,
          ),
        }));
      },

      appendToMessage(messageId, delta) {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, content: m.content + delta } : m,
          ),
        }));
      },

      getSessionMessages(sessionId) {
        return get().messages
          .filter((m) => m.sessionId === sessionId)
          .sort((a, b) => a.createdAt - b.createdAt);
      },
    }),
    {
      name: "hermit-sessions",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
