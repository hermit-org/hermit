import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Session, Message, MessageRole } from "../types";

interface SessionState {
  sessions: Session[];
  messages: Message[];
  activeSessionId: string | null;
  createSession: (gatewayId: string, title?: string) => Session;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  /** Persist the agent-side ACP session ID so it can be resumed later. */
  setSessionAcpId: (id: string, acpSessionId: string) => void;
  addMessage: (sessionId: string, role: MessageRole, content: string) => Message;
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

      createSession(gatewayId, title) {
        const now = Date.now();
        const session: Session = {
          id: generateId("sess"),
          gatewayId,
          title: title ?? "New session",
          createdAt: now,
          updatedAt: now,
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
