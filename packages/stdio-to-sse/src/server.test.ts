import { describe, test, expect } from "bun:test";
import { StdioSseServer, StdioSseClient } from "./index";

async function getFreePort(): Promise<number> {
  // Use a random high port to avoid collisions during parallel test runs.
  return 10000 + Math.floor(Math.random() * 30000);
}

describe("StdioSseServer", () => {
  test("bridges stdin and stdout over HTTP POST -> SSE", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({ command: "cat", port });
    const { url, stop } = await server.start();

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("hello\nworld")) {
        results.push(data);
      }

      expect(results).toEqual(["hello", "world"]);
    } finally {
      await stop();
    }
  });

  test("supports a custom endpoint path", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "cat",
      port,
      endpoint: "/bridge",
    });
    const { url, stop } = await server.start();

    try {
      expect(url).toEndWith("/bridge");

      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("ping")) {
        results.push(data);
      }

      expect(results).toEqual(["ping"]);
    } finally {
      await stop();
    }
  });

  test("returns 404 for unmatched paths", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({ command: "cat", port });
    const { url, stop } = await server.start();

    try {
      const response = await fetch(`${url}/not-found`, { method: "POST" });
      expect(response.status).toBe(404);
    } finally {
      await stop();
    }
  });

  test("returns 404 for non-POST methods", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({ command: "cat", port });
    const { url, stop } = await server.start();

    try {
      const response = await fetch(url, { method: "GET" });
      expect(response.status).toBe(404);
    } finally {
      await stop();
    }
  });

  test("responds to CORS preflight requests", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({ command: "cat", port });
    const { url, stop } = await server.start();

    try {
      const response = await fetch(url, { method: "OPTIONS" });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
    } finally {
      await stop();
    }
  });

  test("forwards command arguments to the child process", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: [
        "-e",
        "process.argv.slice(1).forEach(a => console.log(a))",
        "alpha",
        "beta",
      ],
      port,
    });
    const { url, stop } = await server.start();

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("ignored")) {
        results.push(data);
      }

      expect(results).toEqual(["alpha", "beta"]);
    } finally {
      await stop();
    }
  });

  test("ends the stream when the child exits with a non-zero code", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: ["-e", "console.log('ok'); process.exit(1)"],
      port,
    });
    const { url, stop } = await server.start();

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual(["ok"]);
    } finally {
      await stop();
    }
  });

  test("ends the stream when the child crashes", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: ["-e", "process.stdout.destroy()"],
      port,
    });
    const { url, stop } = await server.start();

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

  test("does not deadlock when the child writes a large amount to stderr", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: [
        "-e",
        "console.error('x'.repeat(1024 * 1024)); console.log('done')",
      ],
      port,
    });
    const { url, stop } = await server.start();

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual(["done"]);
    } finally {
      await stop();
    }
  });

  test("kills the child process when the client disconnects", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: ["-e", "setInterval(() => console.log('tick'), 50)"],
      port,
    });
    const { url, stop } = await server.start();

    const { request } = await import("node:http");
    const parsedUrl = new URL(url);

    let destroyTimer: ReturnType<typeof setTimeout> | undefined;

    const req = request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: "POST",
        agent: false,
        headers: { Connection: "close" },
      },
      (res) => {
        res.on("data", () => {
          // Once we receive the first byte, simulate an abrupt disconnect.
          if (destroyTimer) clearTimeout(destroyTimer);
          req.destroy();
        });
      },
    );

    req.end();

    // Fallback destroy in case no data arrives.
    destroyTimer = setTimeout(() => req.destroy(), 300);

    // Wait for the server to clean up.
    await new Promise((resolve) => setTimeout(resolve, 400));

    // If the child process were not killed, the request handler would never
    // finish and stop() would hang. Stopping successfully proves cleanup works.
    await stop();
  });

  test("works with an empty request body", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: [
        "-e",
        "process.stdin.resume(); process.stdin.on('end', () => console.log('empty'))",
      ],
      port,
    });
    const { url, stop } = await server.start();

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual(["empty"]);
    } finally {
      await stop();
    }
  });

  test("isolates concurrent requests", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: ["-e", "process.stdin.on('data', d => process.stdout.write(d))"],
      port,
    });
    const { url, stop } = await server.start();

    try {
      const clientA = new StdioSseClient({ url });
      const clientB = new StdioSseClient({ url });

      const [a, b] = await Promise.all([
        (async () => {
          const results: string[] = [];
          for await (const data of clientA.send("aaa")) {
            results.push(data);
          }
          return results;
        })(),
        (async () => {
          const results: string[] = [];
          for await (const data of clientB.send("bbb")) {
            results.push(data);
          }
          return results;
        })(),
      ]);

      expect(a).toEqual(["aaa"]);
      expect(b).toEqual(["bbb"]);
    } finally {
      await stop();
    }
  });

  test("terminates the child after the configured timeout", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: ["-e", "setInterval(() => console.log('tick'), 50)"],
      port,
      timeout: 150,
    });
    const { url, stop } = await server.start();

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      // The child produces a frame every 50ms and is killed after 150ms.
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.length).toBeLessThanOrEqual(5);
    } finally {
      await stop();
    }
  });

  test("streams a large number of lines without dropping frames", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({
      command: "node",
      args: [
        "-e",
        "for (let i = 0; i < 100; i++) console.log(String(i).padStart(3, '0'))",
      ],
      port,
    });
    const { url, stop } = await server.start();

    try {
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send("")) {
        results.push(data);
      }

      expect(results).toEqual(
        Array.from({ length: 100 }, (_, i) => String(i).padStart(3, "0")),
      );
    } finally {
      await stop();
    }
  });

  test("accepts a large request body", async () => {
    const port = await getFreePort();
    const server = new StdioSseServer({ command: "cat", port });
    const { url, stop } = await server.start();

    try {
      const body = "x".repeat(1024 * 1024);
      const client = new StdioSseClient({ url });
      const results: string[] = [];

      for await (const data of client.send(body)) {
        results.push(data);
      }

      expect(results).toEqual([body]);
    } finally {
      await stop();
    }
  });
});
