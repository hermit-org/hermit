import { describe, test, expect } from "bun:test";
import { request } from "node:http";
import { AcpGatewayServer } from "./gateway";

async function getFreePort(): Promise<number> {
  return 10000 + Math.floor(Math.random() * 30000);
}

async function post(url: string, body: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body,
  });
}

function readSseUntil(
  url: string,
  predicate: (data: string) => boolean,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const results: string[] = [];

    const req = request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "POST",
      },
      (res) => {
        let buffer = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk: string) => {
          buffer += chunk;
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const match = part.match(/^data: (.*)$/m);
            if (match) {
              results.push(match[1]);
              if (predicate(match[1])) {
                req.destroy();
                resolve(results);
              }
            }
          }
        });
        res.once("error", reject);
      },
    );

    req.once("error", reject);
    req.end();
  });
}

describe("AcpGatewayServer", () => {
  test("streams agent stdout emitted immediately after spawn", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "console.log('startup'); setInterval(() => {}, 1000);"],
      port,
    });

    const { url, stop } = await server.start();

    try {
      const results = await readSseUntil(url, (data) => data === "startup");
      expect(results).toContain("startup");
    } finally {
      await stop();
    }
  });

  test("streams agent stdout over SSE and accepts stdin via /send", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: [
        "-e",
        "process.stdin.on('data', d => process.stdout.write(d)); process.stdin.resume(); setInterval(() => {}, 1000);",
      ],
      port,
      sendEndpoint: "/send",
    });

    const { url, stop } = await server.start();
    const sendUrl = `${url.replace(/\/$/, "")}/send`;

    try {
      const consumePromise = readSseUntil(url, (data) => data === "hello");

      // Give the SSE connection a moment to establish.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const response = await post(sendUrl, "hello\n");
      expect(response.status).toBe(200);

      const results = await consumePromise;
      expect(results).toContain("hello");
    } finally {
      await stop();
    }
  });

  test("returns 404 for unmatched paths", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
    });
    const { url, stop } = await server.start();

    try {
      const response = await fetch(`${url}/not-found`, { method: "POST" });
      expect(response.status).toBe(404);
    } finally {
      await stop();
    }
  });

  test("responds to CORS preflight requests", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
    });
    const { url, stop } = await server.start();

    try {
      const response = await fetch(url, { method: "OPTIONS" });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
    } finally {
      await stop();
    }
  });
});
