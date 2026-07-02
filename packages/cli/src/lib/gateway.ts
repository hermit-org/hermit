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
  /**
   * Idle timeout in milliseconds. If the gateway has no active ACP prompts,
   * no `/send` input, and no stdout/stderr activity for longer than this
   * value, the agent process is stopped. The HTTP server stays running and
   * the agent is respawned on the next SSE or `/send` request. `0` disables
   * the idle timeout (default: 300000).
   */
  idleTimeout?: number;
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
  private agentCommand: string = "";
  private agentArgs: string[] = [];
  private agentCwd?: string;
  private idleTimeout: number = 300000;
  private lastActivityAt: number = Date.now();
  private activePrompts: Set<string | number> = new Set();
  private idleCheckTimer?: ReturnType<typeof setInterval>;
  private spawnPromise?: Promise<void>;
  private agentStoppedIntentionally = false;

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
      idleTimeout,
    } = this.options;

    this.cors = normalizeCors(this.options.cors ?? true);
    this.idleTimeout = idleTimeout ?? 300000;

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
            await this.handleSseRequest(req, res, heartbeatInterval);
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
        if (this.idleTimeout > 0) {
          this.startIdleCheck();
        }

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
    this.agentCommand = command;
    this.agentArgs = args;
    this.agentCwd = cwd;

    this.proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      ...(cwd ? { cwd } : {}),
    });

    this.procExited = false;
    this.agentStoppedIntentionally = false;
    this.recordActivity();

    this.proc.once("error", (error) => {
      this.procExited = true;
      this.broadcastError(error.message);
    });

    this.proc.once("exit", (code, signal) => {
      this.procExited = true;
      if (!this.agentStoppedIntentionally) {
        this.broadcastError(
          signal
            ? `Agent process exited with signal ${signal}`
            : `Agent process exited with code ${code ?? "unknown"}`,
        );
      }
      this.closeAllConnections();
      this.stopIdleCheck();
    });

    const rl = createInterface({
      input: this.proc.stdout!,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      this.recordActivity();
      this.handleAgentStdoutLine(line);
      this.broadcast(line);
    });

    rl.once("close", () => {
      this.closeAllConnections();
    });

    this.proc.stderr!.on("data", (chunk: Buffer) => {
      this.recordActivity();
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

  private async handleSseRequest(
    req: IncomingMessage,
    res: ServerResponse,
    heartbeatInterval: number,
  ): Promise<void> {
    await this.ensureAgentRunning();

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
    await this.ensureAgentRunning();

    try {
      if (!this.proc || this.proc.killed || !this.proc.stdin || this.proc.stdin.destroyed || this.procExited) {
        this.sendJson(res, 503, { ok: false, error: "Agent process is not running" }, req.headers.origin);
        return;
      }

      const body = await readRequestBody(req);
      this.recordActivity();
      this.trackPromptRequestFromBody(body);
      await this.writeToStdin(body);

      this.sendJson(res, 200, { ok: true }, req.headers.origin);
    } catch {
      this.sendJson(res, 503, { ok: false, error: "Agent process is not running" }, req.headers.origin);
    }
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

  private recordActivity(): void {
    this.lastActivityAt = Date.now();
  }

  private trackPromptRequestFromBody(body: Buffer): void {
    const text = body.toString("utf-8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as {
          jsonrpc?: string;
          method?: string;
          id?: string | number;
        };
        if (msg.method === "session/prompt" && msg.id !== undefined) {
          this.activePrompts.add(msg.id);
        }
      } catch {
        // Ignore lines that are not valid JSON-RPC.
      }
    }
  }

  private handleAgentStdoutLine(line: string): void {
    try {
      const msg = JSON.parse(line) as {
        jsonrpc?: string;
        id?: string | number;
        result?: unknown;
        error?: unknown;
      };
      if (
        msg.id !== undefined &&
        this.activePrompts.has(msg.id) &&
        (msg.result !== undefined || msg.error !== undefined)
      ) {
        this.activePrompts.delete(msg.id);
      }
    } catch {
      // Ignore lines that are not valid JSON-RPC.
    }
  }

  private startIdleCheck(): void {
    if (this.idleCheckTimer || this.idleTimeout <= 0) return;
    const checkInterval = Math.min(5000, Math.max(100, Math.floor(this.idleTimeout / 2)));
    this.idleCheckTimer = setInterval(() => {
      if (this.activePrompts.size > 0) return;
      if (Date.now() - this.lastActivityAt > this.idleTimeout) {
        this.stopAgent();
      }
    }, checkInterval);
  }

  private stopIdleCheck(): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = undefined;
    }
  }

  private async ensureAgentRunning(): Promise<void> {
    if (this.proc && !this.proc.killed && !this.procExited) {
      return;
    }
    if (this.spawnPromise) {
      return this.spawnPromise;
    }
    this.spawnPromise = (async () => {
      try {
        this.spawnAgent(this.agentCommand, this.agentArgs, this.agentCwd);
      } finally {
        this.spawnPromise = undefined;
      }
    })();
    return this.spawnPromise;
  }

  private async stopAgent(): Promise<void> {
    if (!this.proc || this.procExited) return;

    this.agentStoppedIntentionally = true;
    this.activePrompts.clear();
    this.closeAllConnections();
    this.stopIdleCheck();

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

    this.proc = undefined;
    this.procExited = true;
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
    this.stopIdleCheck();
    await this.stopAgent();

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
