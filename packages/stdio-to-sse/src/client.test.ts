import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createServer, type Server } from "node:http";
import { StdioSseClient } from "./index";

function startSseServer(
  handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void,
): Promise<{ url: string; server: Server; stop: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        server,
        stop: () => new Promise((resolveStop) => server.close(() => resolveStop())),
      });
    });
  });
}

async function readRequestBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

describe("StdioSseClient", () => {
  test("yields a single SSE data payload", async () => {
    const { url, stop } = await startSseServer(async (req, res) => {
      const body = await readRequestBody(req);
      expect(body).toBe("ping");

      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write("data: hello\n\n");
      res.end();
    });

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("ping")) {
        results.push(data);
      }

      expect(results).toEqual(["hello"]);
    } finally {
      await stop();
    }
  });

  test("yields multiple SSE data payloads", async () => {
    const { url, stop } = await startSseServer(async (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write("data: one\n\ndata: two\n\n");
      res.end();
    });

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual(["one", "two"]);
    } finally {
      await stop();
    }
  });

  test("handles an SSE frame split across multiple chunks", async () => {
    const { url, stop } = await startSseServer(async (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write("data: hel");
      res.write("lo\n\n");
      res.end();
    });

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual(["hello"]);
    } finally {
      await stop();
    }
  });

  test("reconstructs multi-line SSE payloads", async () => {
    const { url, stop } = await startSseServer(async (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write("data: line1\ndata: line2\n\n");
      res.end();
    });

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual(["line1\nline2"]);
    } finally {
      await stop();
    }
  });

  test("handles an empty response body gracefully", async () => {
    const { url, stop } = await startSseServer(async (_req, res) => {
      res.writeHead(200);
      res.end();
    });

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual([]);
    } finally {
      await stop();
    }
  });

  test("throws when the server returns a non-2xx status", async () => {
    const { url, stop } = await startSseServer(async (_req, res) => {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    });

    try {
      const client = new StdioSseClient({ url });
      const iterator = client.send("");

      await expect(iterator.next()).rejects.toThrow("HTTP error 404");
    } finally {
      await stop();
    }
  });

  test("propagates network errors", async () => {
    const client = new StdioSseClient({
      url: "http://127.0.0.1:1",
    });

    await expect(async () => {
      for await (const _ of client.send("")) {
        // consume
      }
    }).toThrow();
  });

  test("accepts responses with non-SSE Content-Type", async () => {
    const { url, stop } = await startSseServer(async (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write("data: still-parsed\n\n");
      res.end();
    });

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual(["still-parsed"]);
    } finally {
      await stop();
    }
  });
});
