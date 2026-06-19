import type {
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
} from "./types";

let idCounter = 0;

export function generateRequestId(): number {
  idCounter += 1;
  return idCounter;
}

export function createRequest<T>(method: string, params?: T): JsonRpcRequest<T> {
  return {
    jsonrpc: "2.0",
    id: generateRequestId(),
    method,
    // Default to `{}`: many agents reject requests that omit `params`
    // entirely (JSON-RPC `params` is expected to be present, and ACP
    // methods like `session/list` validate its presence).
    params: (params ?? {}) as T,
  };
}

export function createNotification<T>(
  method: string,
  params?: T,
): JsonRpcNotification<T> {
  return {
    jsonrpc: "2.0",
    method,
    params: (params ?? {}) as T,
  };
}

export function createSuccessResponse(
  id: string | number,
  result: unknown,
): JsonRpcSuccessResponse {
  return { jsonrpc: "2.0", id, result };
}

export function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

export function encodeMessage(message: JsonRpcMessage): string {
  return `${JSON.stringify(message)}\n`;
}

export function isSuccessResponse(
  message: JsonRpcMessage,
): message is JsonRpcSuccessResponse {
  return "id" in message && "result" in message;
}

export function isErrorResponse(
  message: JsonRpcMessage,
): message is JsonRpcErrorResponse {
  return "id" in message && "error" in message;
}

export function isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
  return "id" in message && "method" in message && !("result" in message) && !("error" in message);
}

export function isNotification(
  message: JsonRpcMessage,
): message is JsonRpcNotification {
  return "method" in message && !("id" in message);
}

export function parseLine(line: string): JsonRpcMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as JsonRpcMessage;
    if (parsed.jsonrpc !== "2.0") return null;
    return parsed;
  } catch {
    return null;
  }
}
