#!/usr/bin/env node
/**
 * Mock ACP agent for local development and demos.
 *
 * Reads newline-delimited JSON-RPC 2.0 messages from stdin and writes
 * responses to stdout. This lets the Hermit CLI gateway forward mobile
 * client requests to a runnable process without requiring a real ACP agent.
 */

const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (request.jsonrpc !== "2.0") return;

  if (request.method === "$/agent/info") {
    send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        name: "kimi-mock",
        version: "0.0.1",
        capabilities: ["chat"],
      },
    });
    return;
  }

  if (request.method === "$/prompt") {
    const prompt = typeof request.params === "string"
      ? request.params
      : JSON.stringify(request.params ?? "");

    send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        content: `🤖 Kimi mock received: "${prompt}"\n\nThis is a synchronous mock response. Replace the agent command in hermit.config.json with a real ACP agent to get live answers.`,
      },
    });
    return;
  }

  // Unknown method
  send({
    jsonrpc: "2.0",
    id: request.id ?? null,
    error: {
      code: -32601,
      message: `Method not found: ${request.method}`,
    },
  });
});

// Keep the process alive until stdin closes.
process.stdin.on("end", () => {
  process.exit(0);
});
