import {
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcSuccessResponse,
  type JsonRpcErrorResponse,
  type JsonRpcMessage,
} from "../types";

let idCounter = 0;

export function generateRequestId(): string {
  idCounter += 1;
  return `req_${Date.now()}_${idCounter}`;
}

export function createRequest<T>(method: string, params?: T): JsonRpcRequest<T> {
  return {
    jsonrpc: "2.0",
    id: generateRequestId(),
    method,
    params,
  };
}

export function createNotification<T>(method: string, params?: T): JsonRpcNotification<T> {
  return {
    jsonrpc: "2.0",
    method,
    params,
  };
}

export function encodeJsonRpcMessage(message: JsonRpcMessage): string {
  return `${JSON.stringify(message)}\n`;
}

export function isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
  return "id" in message && "method" in message && !("result" in message) && !("error" in message);
}

export function isNotification(message: JsonRpcMessage): message is JsonRpcNotification {
  return "method" in message && !("id" in message);
}

export function isSuccessResponse(message: JsonRpcMessage): message is JsonRpcSuccessResponse {
  return "id" in message && "result" in message;
}

export function isErrorResponse(message: JsonRpcMessage): message is JsonRpcErrorResponse {
  return "id" in message && "error" in message;
}

export function parseJsonRpcLine(line: string): JsonRpcMessage | null {
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
