import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { encodeSse, encodeSseKeepAlive } from "@hermit-org/stdio-to-sse";
import {
  type CorsConfig,
  type NormalizedCors,
  normalizeCors,
  corsPreflightHeaders,
  corsOriginHeaders,
} from "./cors";

/**
 * Configuration for `AcpGatewayServer`.
 *
 * The gateway spawns a single long-lived child process and exposes two HTTP
 * endpoints:
 *   - `GET/POST /`  : Server-Sent Events stream of the process stdout.
 *   - `POST /send`  : Writes the request body to the process stdin.
 *
 * This is protocol-agnostic at the transport level: it bridges bytes between
 * stdio and SSE. The CLI adds ACP/MCP-specific routing, pairing, and auth.
 */
export interface ConnectionPayload {
  url: string;
  sendUrl: string;
  token: string;
}

export interface AcpGatewayServerOptions {
  command: string;
  args?: string[];
  /** Working directory for the spawned agent process. */
  cwd?: string;
  port?: number;
  hostname?: string;
  endpoint?: string;
  sendEndpoint?: string;
  qrEndpoint?: string;
  /**
   * CORS configuration.
   *
   * - `true`  : allow all origins (default).
   * - `false` : disable CORS.
   * - object  : fine-grained control (`{ origins, methods, headers }`).
   */
  cors?: CorsConfig;
  heartbeatInterval?: number;
  onRequest?: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => boolean | Promise<boolean>;
  getQrPayload?: () => ConnectionPayload | null | Promise<ConnectionPayload | null>;
}

export interface AcpGatewayServerState {
  url: string;
  stop: () => Promise<void>;
}

interface ActiveConnection {
  res: ServerResponse;
  heartbeatId: ReturnType<typeof setInterval>;
}

/**
 * Gateway that exposes one local stdio process as a persistent SSE endpoint.
 *
 * Transport-layer only: no knowledge of ACP, MCP, JSON-RPC, or any specific
 * protocol. The consumer is expected to send/receive line-delimited messages.
 */
export class AcpGatewayServer {
  private server?: Server;
  private proc?: ChildProcess;
  private connections: Set<ActiveConnection> = new Set();
  private stdinWriteQueue: Array<{
    chunk: Buffer;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private stdinWriting = false;
  private started = false;
  private procExited = false;
  private cors: NormalizedCors = normalizeCors(true);

  constructor(private readonly options: AcpGatewayServerOptions) {}

  async start(): Promise<AcpGatewayServerState> {
    if (this.started) {
      throw new Error("AcpGatewayServer is already started");
    }

    const {
      command,
      args = [],
      cwd,
      port = 8080,
      hostname = "0.0.0.0",
      endpoint = "/",
      sendEndpoint = "/send",
      qrEndpoint = "/qr",
      heartbeatInterval = 30000,
    } = this.options;

    this.cors = normalizeCors(this.options.cors ?? true);

    const normalizedEndpoint = endpoint === "/" ? "/" : endpoint.replace(/\/$/, "");
    const normalizedSendEndpoint = sendEndpoint.replace(/\/$/, "");
    const normalizedQrEndpoint = qrEndpoint.replace(/\/$/, "");

    this.started = true;

    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        if (this.options.onRequest) {
          try {
            const handled = await this.options.onRequest(req, res);
            if (handled) return;
          } catch (error) {
            if (!res.headersSent) {
              res.writeHead(500);
              res.end(error instanceof Error ? error.message : "Internal Server Error");
            }
            return;
          }
        }

        try {
          if (req.method === "OPTIONS" && this.cors.enabled) {
            const headers = corsPreflightHeaders(this.cors, req.headers.origin);
            res.writeHead(204, headers);
            res.end();
            return;
          }

          if ((req.method === "GET" || req.method === "POST") && req.url === normalizedEndpoint) {
            this.handleSseRequest(req, res, heartbeatInterval);
            return;
          }

          if (req.method === "POST" && req.url === normalizedSendEndpoint) {
            await this.handleSendRequest(req, res);
            return;
          }

          if (req.method === "GET" && req.url === normalizedQrEndpoint) {
            await this.handleQrRequest(req, res);
            return;
          }

          res.writeHead(404);
          res.end("Not Found");
        } catch (error) {
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(error instanceof Error ? error.message : "Internal Server Error");
          }
        }
      });

      this.server.once("error", reject);

      this.server.listen(port, hostname, () => {
        this.server!.removeListener("error", reject);
        this.spawnAgent(command, args, cwd);

        const displayEndpoint = normalizedEndpoint === "/" ? "" : normalizedEndpoint;
        const host = hostname === "0.0.0.0" ? "localhost" : hostname;
        const url = `http://${host}:${port}${displayEndpoint}`;

        resolve({
          url,
          stop: () => this.stop(),
        });
      });
    });
  }

  private spawnAgent(command: string, args: string[], cwd?: string): void {
    this.proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      ...(cwd ? { cwd } : {}),
    });

    this.proc.once("error", (error) => {
      this.procExited = true;
      this.broadcastError(error.message);
    });

    this.proc.once("exit", (code, signal) => {
      this.procExited = true;
      this.broadcastError(
        signal
          ? `Agent process exited with signal ${signal}`
          : `Agent process exited with code ${code ?? "unknown"}`,
      );
      this.closeAllConnections();
    });

    const rl = createInterface({
      input: this.proc.stdout!,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      this.broadcast(line);
    });

    rl.once("close", () => {
      this.closeAllConnections();
    });

    this.proc.stderr!.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8").trimEnd();
      if (text) {
        for (const line of text.split("\n")) {
          if (line.trim()) {
            this.broadcastError(line);
          }
        }
      }
    });
  }

  private handleSseRequest(
    req: IncomingMessage,
    res: ServerResponse,
    heartbeatInterval: number,
  ): void {
    const headers: Record<string, string | string[]> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsOriginHeaders(this.cors, req.headers.origin),
    };

    res.writeHead(200, headers);

    const heartbeatId = setInterval(() => {
      if (!res.writableEnded) {
        res.write(encodeSseKeepAlive());
      }
    }, heartbeatInterval);

    const connection: ActiveConnection = { res, heartbeatId };
    this.connections.add(connection);

    res.once("close", () => {
      this.removeConnection(connection);
    });
  }

  private async handleSendRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (!this.proc || this.proc.killed || !this.proc.stdin || this.proc.stdin.destroyed) {
      this.sendJson(res, 503, { ok: false, error: "Agent process is not running" }, req.headers.origin);
      return;
    }

    const body = await readRequestBody(req);
    await this.writeToStdin(body);

    this.sendJson(res, 200, { ok: true }, req.headers.origin);
  }

  private async handleQrRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (!this.options.getQrPayload) {
      this.sendJson(res, 404, { ok: false, error: "QR payload not configured" }, req.headers.origin);
      return;
    }

    const payload = await Promise.resolve(this.options.getQrPayload());
    if (!payload) {
      this.sendJson(res, 404, { ok: false, error: "QR payload not available" }, req.headers.origin);
      return;
    }

    const { generateQrBuffer } = await import("./qr");
    const buffer = await generateQrBuffer(payload);

    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
      ...corsOriginHeaders(this.cors, req.headers.origin),
    };

    res.writeHead(200, headers);
    res.end(buffer);
  }

  private writeToStdin(chunk: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stdinWriteQueue.push({ chunk, resolve, reject });
      this.flushStdinQueue().catch(reject);
    });
  }

  private async flushStdinQueue(): Promise<void> {
    if (this.stdinWriting || this.stdinWriteQueue.length === 0) return;

    this.stdinWriting = true;

    while (this.stdinWriteQueue.length > 0) {
      const { chunk, resolve, reject } = this.stdinWriteQueue.shift()!;

      try {
        await new Promise<void>((writeResolve, writeReject) => {
          if (!this.proc || !this.proc.stdin || this.proc.stdin.destroyed) {
            writeReject(new Error("Agent stdin is not available"));
            return;
          }

          const canContinue = this.proc.stdin.write(chunk, (error) => {
            if (error) writeReject(error);
            else writeResolve();
          });

          if (!canContinue) {
            this.proc.stdin.once("drain", writeResolve);
          }
        });
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.stdinWriting = false;
  }

  private broadcast(payload: string): void {
    const frame = encodeSse(payload);
    for (const connection of this.connections) {
      if (!connection.res.writableEnded) {
        connection.res.write(frame);
      }
    }
  }

  private broadcastError(message: string): void {
    const frame = encodeSse(message, { event: "error" });
    for (const connection of this.connections) {
      if (!connection.res.writableEnded) {
        connection.res.write(frame);
      }
    }
  }

  private removeConnection(connection: ActiveConnection): void {
    this.connections.delete(connection);
    clearInterval(connection.heartbeatId);
    if (!connection.res.writableEnded) {
      connection.res.end();
    }
  }

  private closeAllConnections(): void {
    for (const connection of this.connections) {
      this.removeConnection(connection);
    }
  }

  private sendJson(
    res: ServerResponse,
    status: number,
    payload: unknown,
    reqOrigin?: string,
  ): void {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...corsOriginHeaders(this.cors, reqOrigin),
    };
    res.writeHead(status, headers);
    res.end(JSON.stringify(payload));
  }

  private async stop(): Promise<void> {
    this.closeAllConnections();

    if (this.proc && !this.procExited) {
      if (!this.proc.killed) {
        this.proc.kill();
      }
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.proc?.kill("SIGKILL");
          resolve();
        }, 5000);
        this.proc?.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    return new Promise((resolve) => {
      this.server?.close(() => resolve());
      this.server?.closeAllConnections?.();
    });
  }
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
