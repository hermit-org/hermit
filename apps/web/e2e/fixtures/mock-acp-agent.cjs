#!/usr/bin/env node
/**
 * Minimal ACP agent for web E2E tests.
 *
 * Reads newline-delimited JSON-RPC 2.0 messages from stdin and writes responses
 * to stdout. Implements just enough of ACP v1 to support the web client's
 * connect -> session -> prompt flow used by the E2E suite.
 */

const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

let nextId = 1;
const sessions = new Map();

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendNotification(method, params) {
  send({ jsonrpc: "2.0", method, params });
}

function makeSession(id) {
  return {
    sessionId: id,
    cwd: "/",
    title: "E2E Session",
    updatedAt: new Date().toISOString(),
  };
}

function handleInitialize(request) {
  return {
    jsonrpc: "2.0",
    id: request.id,
    result: {
      protocolVersion: 1,
      agentInfo: {
        name: "hermit-e2e-agent",
        title: "Hermit E2E Agent",
        version: "0.0.1",
      },
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: false,
        },
        sessionCapabilities: {
          list: {},
          resume: {},
          close: {},
          delete: {},
        },
      },
      authMethods: [],
    },
  };
}

function handleSessionList(request) {
  return {
    jsonrpc: "2.0",
    id: request.id,
    result: {
      sessions: Array.from(sessions.values()).map((s) => ({
        sessionId: s.sessionId,
        cwd: s.cwd,
        title: s.title,
        updatedAt: s.updatedAt,
      })),
    },
  };
}

function handleSessionNew(request) {
  const id = `sess_${Date.now()}_${nextId++}`;
  const session = makeSession(id);
  sessions.set(id, session);
  return {
    jsonrpc: "2.0",
    id: request.id,
    result: {
      sessionId: id,
      modes: {
        currentModeId: "chat",
        availableModes: [
          { id: "chat", name: "Chat", description: "General chat mode" },
        ],
      },
    },
  };
}

function handleSessionLoad(request) {
  return { jsonrpc: "2.0", id: request.id, result: null };
}

function handleSessionResume(request) {
  const { sessionId } = request.params || {};
  return {
    jsonrpc: "2.0",
    id: request.id,
    result: { sessionId: sessionId || "sess_resume" },
  };
}

function handleSessionClose(request) {
  const { sessionId } = request.params || {};
  sessions.delete(sessionId);
  return { jsonrpc: "2.0", id: request.id, result: null };
}

function handleSessionDelete(request) {
  const { sessionId } = request.params || {};
  sessions.delete(sessionId);
  return { jsonrpc: "2.0", id: request.id, result: null };
}

function handleSessionSetMode(request) {
  return { jsonrpc: "2.0", id: request.id, result: null };
}

function handleSessionSetConfigOption(request) {
  return {
    jsonrpc: "2.0",
    id: request.id,
    result: {
      configOption: {
        type: "text",
        id: "model",
        name: "Model",
        currentValue: "default",
      },
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function handleSessionPrompt(request) {
  const { sessionId, prompt } = request.params || {};
  const text = prompt?.find((p) => p.type === "text")?.text ?? "";
  const messageId = `msg_${Date.now()}`;

  // Stream the assistant response as a single chunk so E2E assertions see one
  // complete assistant bubble. We intentionally do NOT emit user_message_chunk
  // here: the web client already adds the user message to the transcript
  // optimistically, and echoing it back would briefly show a duplicate bubble
  // while the turn is still streaming.
  const response = `Echo: ${text}`;
  sendNotification("session/update", {
    sessionId,
    update: {
      sessionUpdate: "agent_message_chunk",
      messageId,
      content: { type: "text", text: response },
    },
  });

  // Pause briefly before returning the final result. The web adapter mirrors
  // live turn state into a ref via an effect; an immediate response can win the
  // race and clear the turn before the ref is updated.
  return sleep(150).then(() => ({
    jsonrpc: "2.0",
    id: request.id,
    result: { stopReason: "end_turn" },
  }));
}

function handleAuthenticate(request) {
  return { jsonrpc: "2.0", id: request.id, result: null };
}

function handleLogout(request) {
  return { jsonrpc: "2.0", id: request.id, result: null };
}

async function handleRequest(request) {
  switch (request.method) {
    case "initialize":
      return handleInitialize(request);
    case "session/list":
      return handleSessionList(request);
    case "session/new":
      return handleSessionNew(request);
    case "session/load":
      return handleSessionLoad(request);
    case "session/resume":
      return handleSessionResume(request);
    case "session/close":
      return handleSessionClose(request);
    case "session/delete":
      return handleSessionDelete(request);
    case "session/set_mode":
      return handleSessionSetMode(request);
    case "session/set_config_option":
      return handleSessionSetConfigOption(request);
    case "session/prompt":
      return handleSessionPrompt(request);
    case "authenticate":
      return handleAuthenticate(request);
    case "logout":
      return handleLogout(request);
    default:
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      };
  }
}

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (request.jsonrpc !== "2.0") return;

  // Notifications have no id and do not need a response.
  if (request.id === undefined) {
    if (request.method === "session/cancel") {
      // No-op for tests.
    }
    return;
  }

  const response = await handleRequest(request);
  send(response);
});

process.stdin.on("end", () => {
  process.exit(0);
});
