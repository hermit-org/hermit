import { describe, test, expect } from "bun:test";
import { request, type ClientRequest } from "node:http";
import { AcpGatewayServer } from "./gateway";

/**
 * Pick a random port in the ephemeral range to reduce collisions between
 * parallel test runs.
 */
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

interface SseEvent {
  event?: string;
  data?: string;
  comment?: string;
}

/**
 * Collect SSE frames from the endpoint. Resolves when `predicate` returns
 * true, when the response stream ends (server closed the connection), or
 * when the timeout fires. Captures event names, data payloads, and comment
 * frames so callers can assert on whatever was received.
 */
function consumeSse(
  url: string,
  predicate: (events: SseEvent[]) => boolean,
  timeoutMs = 3000,
): Promise<SseEvent[]> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const events: SseEvent[] = [];
    let buffer = "";
    let settled = false;

    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Only resolve with collected events; connection closure is a normal
      // termination, not an error.
      if (err) reject(err);
      else resolve(events);
    };

    const timer = setTimeout(
      () => finish(new Error("SSE timeout")),
      timeoutMs,
    );

    const req: ClientRequest = request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "POST",
      },
      (res) => {
        res.setEncoding("utf-8");
        res.on("data", (chunk: string) => {
          buffer += chunk;
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const evt: SseEvent = {};
            for (const line of part.split("\n")) {
              if (line.startsWith(":")) {
                evt.comment = line.slice(1);
              } else if (line.startsWith("event: ")) {
                evt.event = line.slice(7);
              } else if (line.startsWith("data: ")) {
                evt.data = evt.data
                  ? `${evt.data}\n${line.slice(6)}`
                  : line.slice(6);
              }
            }
            events.push(evt);
            try {
              if (predicate(events)) finish();
            } catch (err) {
              finish(err);
            }
          }
        });
        // When the server closes the connection, resolve with whatever we
        // have collected so far. This lets callers assert on terminal events
        // (e.g. process exit) that are immediately followed by a close.
        res.once("end", () => finish());
        res.once("close", () => finish());
        res.once("error", (err) => finish(err));
      },
    );

    req.once("error", (err) => finish(err));
    req.end();
  });
}

/** Legacy helper kept for the original stdin-echo test. */
function readSseUntil(
  url: string,
  predicate: (data: string) => boolean,
): Promise<string[]> {
  return consumeSse(url, (events) => {
    const last = events[events.length - 1];
    if (last?.data !== undefined && predicate(last.data)) return true;
    return false;
  }).then((events) => events.map((e) => e.data ?? "").filter(Boolean));
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

describe("AcpGatewayServer startup", () => {
  test("throws when start() is called twice", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
    });

    const { stop } = await server.start();
    try {
      await expect(server.start()).rejects.toThrow(/already started/);
    } finally {
      await stop();
    }
  });

  test("rejects when the port is already in use", async () => {
    const port = await getFreePort();
    const first = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
    });
    const { stop: stopFirst } = await first.start();

    const second = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
    });
    try {
      await expect(second.start()).rejects.toThrow();
    } finally {
      await stopFirst();
    }
  });

  test("builds the url from custom hostname and endpoint", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      hostname: "127.0.0.1",
      endpoint: "/events",
    });

    const { url, stop } = await server.start();
    try {
      expect(url).toBe(`http://127.0.0.1:${port}/events`);
    } finally {
      await stop();
    }
  });

  test("uses localhost in url when binding to 0.0.0.0", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      hostname: "0.0.0.0",
    });

    const { url, stop } = await server.start();
    try {
      expect(url).toContain("localhost");
    } finally {
      await stop();
    }
  });

  test("strips trailing slash from custom endpoints", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      sendEndpoint: "/send/",
      qrEndpoint: "/qr/",
    });

    const { url, stop } = await server.start();
    try {
      const res = await post(`${url}/send`, "hi");
      expect(res.status).toBe(200);
    } finally {
      await stop();
    }
  });
});

describe("AcpGatewayServer onRequest hook", () => {
  test("onRequest returning true short-circuits default handling", async () => {
    const port = await getFreePort();
    let hit = false;
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      onRequest: (_req, res) => {
        hit = true;
        res.writeHead(201, { "Content-Type": "text/plain" });
        res.end("intercepted");
        return true;
      },
    });

    const { url, stop } = await server.start();
    try {
      const response = await fetch(url);
      expect(hit).toBe(true);
      expect(response.status).toBe(201);
      expect(await response.text()).toBe("intercepted");
    } finally {
      await stop();
    }
  });

  test("onRequest returning false continues normal routing", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      onRequest: () => false,
    });

    const { url, stop } = await server.start();
    try {
      const response = await fetch(`${url}/missing`);
      expect(response.status).toBe(404);
    } finally {
      await stop();
    }
  });

  test("onRequest throwing returns 500", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      onRequest: () => {
        throw new Error("boom");
      },
    });

    const { url, stop } = await server.start();
    try {
      const response = await fetch(url);
      expect(response.status).toBe(500);
      expect(await response.text()).toBe("boom");
    } finally {
      await stop();
    }
  });

  test("onRequest can be async", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      onRequest: async (_req, res) => {
        await new Promise((r) => setTimeout(r, 10));
        res.writeHead(202);
        res.end();
        return true;
      },
    });

    const { url, stop } = await server.start();
    try {
      const response = await fetch(url);
      expect(response.status).toBe(202);
    } finally {
      await stop();
    }
  });
});

describe("AcpGatewayServer CORS", () => {
  test("disabled CORS makes OPTIONS fall through to 404", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      cors: false,
    });
    const { url, stop } = await server.start();
    try {
      const response = await fetch(url, { method: "OPTIONS" });
      expect(response.status).toBe(404);
    } finally {
      await stop();
    }
  });

  test("specific origin is echoed on CORS preflight", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      cors: { origins: ["http://test.local"] },
    });
    const { url, stop } = await server.start();
    try {
      const response = await fetch(url, {
        method: "OPTIONS",
        headers: { Origin: "http://test.local" },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "http://test.local",
      );
      expect(response.headers.get("vary")).toBe("Origin");
    } finally {
      await stop();
    }
  });

  test("disallowed origin gets no CORS headers on preflight", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      cors: { origins: ["http://test.local"] },
    });
    const { url, stop } = await server.start();
    try {
      const response = await fetch(url, {
        method: "OPTIONS",
        headers: { Origin: "http://evil.test" },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await stop();
    }
  });
});

describe("AcpGatewayServer SSE heartbeat", () => {
  test("emits keep-alive comment frames at the configured interval", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "setInterval(() => {}, 1000);"],
      port,
      heartbeatInterval: 50,
    });

    const { url, stop } = await server.start();
    try {
      const events = await consumeSse(url, (evts) =>
        evts.some((e) => e.comment !== undefined),
      );
      expect(events.some((e) => e.comment !== undefined)).toBe(true);
    } finally {
      await stop();
    }
  });
});

describe("AcpGatewayServer agent process events", () => {
  test("broadcasts stderr output as error events", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stderr.write('warn-line\\n'); setInterval(() => {}, 1000);"],
      port,
    });

    const { url, stop } = await server.start();
    try {
      const events = await consumeSse(url, (evts) =>
        evts.some((e) => e.event === "error" && e.data === "warn-line"),
      );
      expect(events.some((e) => e.event === "error" && e.data === "warn-line")).toBe(true);
    } finally {
      await stop();
    }
  });

  test("closes connections when the process exits with a code", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: [
        "-e",
        "process.stdout.write('ready\\n'); setTimeout(() => process.exit(2), 300);",
      ],
      port,
    });

    const { url, stop } = await server.start();
    try {
      // The process emits "ready" then exits. The stdout stream closes
      // before the exit event, so the SSE connection is torn down once the
      // process is gone. We assert that we received the marker and that the
      // connection was terminated by the server.
      const events = await consumeSse(url, () => false);
      expect(events.some((e) => e.data === "ready")).toBe(true);
    } finally {
      await stop();
    }
  });

  test("closes connections when the process exits via signal", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: [
        "-e",
        "process.stdout.write('ready\\n'); setTimeout(() => process.kill(process.pid, 'SIGINT'), 300);",
      ],
      port,
    });

    const { url, stop } = await server.start();
    try {
      const events = await consumeSse(url, () => false);
      expect(events.some((e) => e.data === "ready")).toBe(true);
    } finally {
      await stop();
    }
  });

  test("handles a spawn error without crashing the gateway", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "this-command-does-not-exist-xyz",
      args: [],
      port,
    });

    const { stop } = await server.start();
    // Give the spawn error event time to fire.
    await new Promise((resolve) => setTimeout(resolve, 200));
    // The gateway must still shut down cleanly after a failed spawn.
    await expect(stop()).resolves.toBeUndefined();
  });
});

describe("AcpGatewayServer /send endpoint", () => {
  test("returns 503 when the agent process is not running", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.exit(0);"],
      port,
      sendEndpoint: "/send",
    });

    const { url, stop } = await server.start();
    const sendUrl = `${url.replace(/\/$/, "")}/send`;
    try {
      // Wait for the spawned process to exit.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const response = await post(sendUrl, "hello\n");
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toMatch(/not running/);
    } finally {
      await stop();
    }
  });
});

describe("AcpGatewayServer /qr endpoint", () => {
  test("returns 404 when getQrPayload is not configured", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      qrEndpoint: "/qr",
    });

    const { url, stop } = await server.start();
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/qr`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toMatch(/not configured/);
    } finally {
      await stop();
    }
  });

  test("returns 404 when getQrPayload returns null", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      qrEndpoint: "/qr",
      getQrPayload: () => null,
    });

    const { url, stop } = await server.start();
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/qr`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toMatch(/not available/);
    } finally {
      await stop();
    }
  });

  test("returns a PNG image when getQrPayload is configured", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "process.stdin.resume();"],
      port,
      qrEndpoint: "/qr",
      getQrPayload: () => ({
        url: "http://localhost:8787/",
        sendUrl: "http://localhost:8787/send",
        token: "tok_test",
      }),
    });

    const { url, stop } = await server.start();
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/qr`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("cache-control")).toBe("no-store");
      const buf = Buffer.from(await response.arrayBuffer());
      // PNG signature.
      expect(buf[0]).toBe(0x89);
      expect(buf.slice(1, 4).toString("ascii")).toBe("PNG");
    } finally {
      await stop();
    }
  });
});

describe("AcpGatewayServer stop", () => {
  test("gracefully stops a cooperative process", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: ["-e", "setInterval(() => {}, 1000);"],
      port,
    });

    const { stop } = await server.start();
    await stop();
    // A second stop should not throw and should resolve.
    await expect(stop()).resolves.toBeUndefined();
  });

  test("force-kills a process that ignores SIGTERM", async () => {
    const port = await getFreePort();
    const server = new AcpGatewayServer({
      command: "node",
      args: [
        "-e",
        // Register the SIGTERM handler before signalling readiness so the
        // gateway's graceful kill has no effect and the SIGKILL fallback
        // kicks in after the internal timeout.
        "process.on('SIGTERM', () => {});"
          + "process.stdout.write('ready\\n');"
          + "setInterval(() => {}, 500);",
      ],
      port,
    });

    const { url, stop } = await server.start();
    // Wait until the child has fully started (handler installed) before
    // stopping, otherwise the default SIGTERM behaviour would exit it.
    await consumeSse(url, (evts) => evts.some((e) => e.data === "ready"));

    // The internal grace period is 5000ms; the promise resolves once the
    // SIGKILL fallback fires.
    await expect(stop()).resolves.toBeUndefined();
  }, 15000);
});
