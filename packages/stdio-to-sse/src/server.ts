import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { encodeSse, encodeSseKeepAlive } from "./sse";

/**
 * Configuration for `StdioSseServer`.
 *
 * The server spawns a child process (`command` + `args`) and exposes an HTTP
 * endpoint. Every POST request to that endpoint becomes one invocation: the
 * request body is written to the child process stdin, and the child process
 * stdout is streamed back to the client as SSE frames.
 */
export interface StdioSseServerOptions {
  /** Command to spawn (e.g. `"cat"`, `"python"`, `"node"`). */
  command: string;
  /** Arguments passed to the command. */
  args?: string[];
  /** Port to listen on. */
  port?: number;
  /** Hostname to bind to. */
  hostname?: string;
  /** HTTP endpoint path (default: `"/"`). */
  endpoint?: string;
  /** Enable permissive CORS headers (default: `true`). */
  cors?: boolean;
  /** Maximum time in milliseconds to wait for the child process (default: no timeout). */
  timeout?: number;
  /**
   * Heartbeat interval in milliseconds (default: `30000`).
   *
   * The server emits SSE comment frames at this interval to keep the HTTP
   * connection alive through proxies and detect half-open sockets.
   */
  heartbeatInterval?: number;
  /**
   * Optional hook called for every incoming request before the default
   * endpoint logic runs. Return `true` (or a promise resolving to `true`) to
   * indicate that the request has been fully handled and default routing
   * should be skipped.
   */
  onRequest?: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => boolean | Promise<boolean>;
}

/** State returned after the server starts successfully. */
export interface StdioSseServerState {
  /** Full URL of the exposed endpoint. */
  url: string;
  /** Stop the HTTP server. */
  stop: () => Promise<void>;
}

/**
 * HTTP server that forwards request bodies to a child process via stdin
 * and streams the child process stdout back as SSE.
 *
 * This class is intentionally protocol-agnostic: it does not parse JSON-RPC,
 * MCP, ACP, or any other message format. It simply bridges bytes. However, it
 * does provide transport-level guarantees required by these protocols:
 *   - UTF-8 integrity of request and response bodies.
 *   - Line-delimited framing of stdout (one SSE data frame per line).
 *   - SSE keep-alive heartbeats to survive proxies and idle timeouts.
 *
 * Implementation is based on Node.js built-in modules so the package can run
 * under Node.js as well as Bun.
 */
export class StdioSseServer {
  private server?: Server;

  constructor(private readonly options: StdioSseServerOptions) {}

  /**
   * Start the HTTP server and spawn the configured child process on each request.
   */
  start(): Promise<StdioSseServerState> {
    const {
      command,
      args = [],
      port = 8080,
      hostname = "0.0.0.0",
      endpoint = "/",
      cors = true,
      timeout,
      heartbeatInterval = 30000,
    } = this.options;

    // Normalize the endpoint path so matching is consistent.
    const normalizedEndpoint =
      endpoint === "/" ? "/" : endpoint.replace(/\/$/, "");

    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        if (this.options.onRequest) {
          const handled = await this.options.onRequest(req, res);
          if (handled) return;
        }

        let proc: ChildProcess | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let heartbeatId: ReturnType<typeof setInterval> | undefined;
        let finished = false;

        const finish = (): void => {
          if (finished) return;
          finished = true;

          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }

          if (heartbeatId) {
            clearInterval(heartbeatId);
            heartbeatId = undefined;
          }

          if (!res.writableEnded) {
            res.end();
          }

          if (proc && !proc.killed) {
            proc.kill();
          }
        };

        try {
          // Respond to CORS preflight requests when CORS is enabled.
          if (cors && req.method === "OPTIONS") {
            res.writeHead(204, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            });
            res.end();
            return;
          }

          // Only POST requests to the configured endpoint are accepted.
          if (req.method !== "POST" || req.url !== normalizedEndpoint) {
            res.writeHead(404);
            res.end("Not Found");
            return;
          }

          const body = await readRequestBody(req);

          // Spawn one child process per request. Each request is isolated.
          // stderr is ignored to prevent the child from deadlocking when it
          // writes large amounts of diagnostic output.
          proc = spawn(command, args, {
            stdio: ["pipe", "pipe", "ignore"],
          });

          // Forward the HTTP body to the child's stdin and close it so the child
          // knows no more input is coming.
          if (body) {
            proc.stdin!.write(body);
          }
          proc.stdin!.end();

          const headers: Record<string, string | string[]> = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          };

          if (cors) {
            headers["Access-Control-Allow-Origin"] = "*";
          }

          res.writeHead(200, headers);

          // Emit periodic SSE comment frames to keep the connection alive.
          if (heartbeatInterval > 0) {
            heartbeatId = setInterval(() => {
              if (!res.writableEnded) {
                res.write(encodeSseKeepAlive());
              }
            }, heartbeatInterval);
          }

          // If the client disconnects, terminate the child process to avoid
          // orphan processes and wasted resources.
          res.once("close", () => {
            finish();
          });

          proc.once("error", (error) => {
            if (!res.writableEnded) {
              res.write(encodeSse(error.message, { event: "error" }));
            }
            finish();
          });

          proc.once("exit", () => {
            finish();
          });

          if (timeout) {
            timeoutId = setTimeout(() => {
              if (!res.writableEnded) {
                res.write(encodeSse("Request timed out", { event: "error" }));
              }
              proc?.kill("SIGKILL");
              finish();
            }, timeout);
          }

          // Read stdout line-by-line and re-emit each line as an SSE frame.
          // `createInterface` handles UTF-8 boundary preservation internally,
          // so multi-byte characters split across stdout chunks are not cut.
          const rl = createInterface({
            input: proc.stdout!,
            crlfDelay: Infinity,
          });

          for await (const line of rl) {
            if (res.writableEnded) break;
            res.write(encodeSse(line));
          }

          finish();
        } catch (error) {
          finish();

          if (!res.headersSent) {
            res.writeHead(500);
          }
          if (!res.writableEnded) {
            res.end(
              error instanceof Error ? error.message : "Internal Server Error",
            );
          }
        }
      });

      this.server.once("error", reject);

      this.server.listen(port, hostname, () => {
        this.server!.removeListener("error", reject);

        const displayEndpoint =
          normalizedEndpoint === "/" ? "" : normalizedEndpoint;
        const protocol = "http";
        const host = hostname === "0.0.0.0" ? "localhost" : hostname;
        const url = `${protocol}://${host}:${port}${displayEndpoint}`;

        resolve({
          url,
          stop: () =>
            new Promise((resolveStop) => {
              this.server!.close(() => resolveStop());
              // Forcefully close any open connections so the server can shut
              // down promptly, even if a client has disconnected abruptly.
              this.server!.closeAllConnections?.();
            }),
        });
      });
    });
  }
}

function readRequestBody(
  req: import("node:http").IncomingMessage,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}
