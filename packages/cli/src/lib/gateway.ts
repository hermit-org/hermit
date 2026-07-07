import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { encodeSse, encodeSseKeepAlive } from "@hermit-org/stdio-to-sse";
import type { AgentConfig } from "@hermit-org/acp-ext";
import { isExtMethod, AcpExtMethod, AcpExtNotification } from "@hermit-org/acp-ext";
import {
  type CorsConfig,
  type NormalizedCors,
  normalizeCors,
  corsPreflightHeaders,
  corsOriginHeaders,
} from "./cors";
import { expandTilde } from "./config";

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
  /** All configured agents (for `_agent/*` extension support). */
  agents?: AgentConfig[];
  /** The agent to activate on startup. */
  activeAgentId?: string | null;
  /** Called whenever the agent list or the active agent changes. */
  onAgentChanged?: (agents: AgentConfig[], activeAgentId: string | null) => void;
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
  private agents: AgentConfig[] = [];
  private currentAgentId: string | null = null;
  /** Stdin data received while the agent process is not yet ready. */
  private pendingStdinBuffers: Buffer[] = [];
  /** True once the current agent process has emitted at least one stdout line. */
  private procReady = false;

  constructor(private readonly options: AcpGatewayServerOptions) {}

  /** Structured log to stdout for diagnostics. */
  private log(message: string): void {
    console.log(`[gateway] ${new Date().toISOString()} ${message}`);
  }

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
    this.agents = this.options.agents ?? [];
    this.currentAgentId = this.options.activeAgentId ?? null;

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

    this.log(`spawning agent: ${command} ${args.join(" ")} (cwd: ${cwd ?? "inherit"})`);

    this.proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      ...(cwd ? { cwd: expandTilde(cwd) } : {}),
    });

    this.log(`agent pid: ${this.proc.pid}`);

    this.procExited = false;
    this.procReady = false;
    this.agentStoppedIntentionally = false;
    this.recordActivity();

    // Mark the process as "ready" on the next event-loop tick. Async spawn
    // errors (ENOENT) fire on the next tick; if the process is still alive
    // at that point, it's safe to write.
    setImmediate(() => {
      if (this.proc && !this.procExited && !this.proc.killed) {
        this.procReady = true;
        this.log(`agent ready (procReady=true), flushing ${this.pendingStdinBuffers.length} pending buffer(s)`);
        this.flushPendingStdin();
      }
    });

    this.proc.once("error", (error) => {
      this.procExited = true;
      this.log(`agent spawn error: ${error.message}`);
      this.broadcastError(error.message);
    });

    this.proc.once("exit", (code, signal) => {
      this.procExited = true;
      this.log(`agent exited: code=${code} signal=${signal} intentional=${this.agentStoppedIntentionally}`);
      if (!this.agentStoppedIntentionally) {
        this.broadcastError(
          signal
            ? `Agent process exited with signal ${signal}`
            : `Agent process exited with code ${code ?? "unknown"}`,
        );
      }
      // Do NOT close SSE connections — the gateway stays alive and can
      // respawn the agent on the next request.
      this.stopIdleCheck();
    });

    const rl = createInterface({
      input: this.proc.stdout!,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      this.recordActivity();
      // Mark ready on first stdout line (covers the case where the grace
      // timer hasn't fired yet but the process is already producing output).
      if (!this.procReady) {
        this.log("agent first stdout line received — marking procReady=true");
      }
      this.procReady = true;
      this.flushPendingStdin();
      this.handleAgentStdoutLine(line);
      this.broadcast(line);
    });

    rl.once("close", () => {
      // stdout closed (process exited). Keep SSE alive for respawn.
    });

    this.proc.stderr!.on("data", (chunk: Buffer) => {
      this.recordActivity();
      const text = chunk.toString("utf-8").trimEnd();
      if (text) {
        for (const line of text.split("\n")) {
          if (line.trim()) {
            this.log(`agent stderr: ${line}`);
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
    // Open the SSE stream immediately — do NOT wait for the agent process.
    // The agent is spawned lazily on the first `/send` request that carries
    // a standard ACP method. This lets the client receive "gateway connected"
    // status without blocking on agent startup (which can take 30s+).
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
    this.log(`SSE client connected (total: ${this.connections.size})`);

    res.once("close", () => {
      this.removeConnection(connection);
    });
  }

  private async handleSendRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      const body = await readRequestBody(req);

      // Check if any line is an extension method (`_`-prefixed). If so, the
      // gateway handles those itself; the remaining (standard) lines are
      // forwarded to the agent stdin as usual.
      const { extLines, stdLines } = this.splitExtLines(body);

      if (extLines.length > 0 || stdLines.length > 0) {
        const extMethods = extLines.map((l) => {
          try { return (JSON.parse(l) as { method?: string }).method; } catch { return "?"; }
        });
        const stdMethods = stdLines.map((l) => {
          try { return (JSON.parse(l) as { method?: string }).method; } catch { return "?"; }
        });
        this.log(`/send: ext=[${extMethods.join(",")}] std=[${stdMethods.join(",")}] procReady=${this.procReady} procExited=${this.procExited}`);
      }

      // Handle extension requests first.
      for (const line of extLines) {
        await this.handleExtRequest(line);
      }

      // Forward standard lines to the agent.
      if (stdLines.length > 0) {
        // Kick off spawn if needed — do NOT await. The gateway accepts the
        // data immediately and flushes it once the process is ready.
        this.ensureAgentRunning();

        const stdBuffer = Buffer.from(stdLines.join("\n") + "\n", "utf-8");
        this.trackPromptRequestFromBody(stdBuffer);

        if (this.isStdinReady()) {
          // Process is alive and stdin is writable — write immediately.
          this.recordActivity();
          this.log(`writing ${stdBuffer.length} bytes to agent stdin`);
          await this.writeToStdin(stdBuffer);
          this.sendJson(res, 200, { ok: true }, req.headers.origin);
        } else {
          // Process not ready yet — buffer the data for flush on first stdout.
          this.pendingStdinBuffers.push(stdBuffer);
          this.recordActivity();
          this.log(`agent not ready — buffered ${stdBuffer.length} bytes (pending: ${this.pendingStdinBuffers.length} buffers)`);
          this.sendJson(res, 202, { ok: true, queued: true }, req.headers.origin);
        }
      } else {
        this.sendJson(res, 200, { ok: true }, req.headers.origin);
      }
    } catch {
      this.sendJson(res, 503, { ok: false, error: "Agent process is not running" }, req.headers.origin);
    }
  }

  /**
   * Split a raw request body into extension lines (`_`-prefixed method) and
   * standard lines (everything else).
   */
  private splitExtLines(body: Buffer): { extLines: string[]; stdLines: string[] } {
    const extLines: string[] = [];
    const stdLines: string[] = [];
    const text = body.toString("utf-8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as { jsonrpc?: string; method?: string };
        if (msg.jsonrpc === "2.0" && msg.method && isExtMethod(msg.method)) {
          extLines.push(line);
        } else {
          stdLines.push(line);
        }
      } catch {
        // Not valid JSON — forward as-is to the agent.
        stdLines.push(line);
      }
    }
    return { extLines, stdLines };
  }

  /**
   * Handle a single `_`-prefixed extension JSON-RPC request. The response is
   * broadcast to all SSE connections (not written to the agent stdin).
   */
  private async handleExtRequest(line: string): Promise<void> {
    let msg: { id?: string | number; method?: string; params?: unknown };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const { id, method, params } = msg;
    if (!method) return;

    let result: unknown = null;
    let error: { code: number; message: string } | null = null;

    try {
      switch (method) {
        case AcpExtMethod.AgentList:
          result = { agents: this.agents, currentAgentId: this.currentAgentId };
          break;
        case AcpExtMethod.AgentGet: {
          const p = params as { agentId?: string };
          const agent = this.agents.find((a) => a.id === p?.agentId);
          if (!agent) throw new Error(`Agent not found: ${p?.agentId ?? ""}`);
          result = { agent };
          break;
        }
        case AcpExtMethod.AgentCreate: {
          const p = params as { agent?: Partial<AgentConfig> };
          const input = p?.agent;
          if (!input?.command) throw new Error("agent.command is required");
          const newAgent: AgentConfig = {
            id: input.id || this.generateUniqueAgentId(),
            name: input.name || input.id || input.command,
            command: input.command,
            args: input.args ?? [],
            cwd: input.cwd,
          };
          this.agents = [...this.agents, newAgent];
          if (this.currentAgentId === null) this.currentAgentId = newAgent.id;
          this.notifyAgentChanged();
          result = { agent: newAgent };
          break;
        }
        case AcpExtMethod.AgentUpdate: {
          const p = params as { agent?: AgentConfig };
          const updated = p?.agent;
          if (!updated?.id) throw new Error("agent.id is required");
          const idx = this.agents.findIndex((a) => a.id === updated.id);
          if (idx === -1) throw new Error(`Agent not found: ${updated.id}`);
          this.agents = this.agents.map((a) => (a.id === updated.id ? updated : a));
          this.notifyAgentChanged();
          result = { agent: updated };
          break;
        }
        case AcpExtMethod.AgentDelete: {
          const p = params as { agentId?: string };
          const agentId = p?.agentId;
          if (!agentId) throw new Error("agentId is required");
          this.agents = this.agents.filter((a) => a.id !== agentId);
          if (this.currentAgentId === agentId) {
            this.currentAgentId = this.agents[0]?.id ?? null;
          }
          this.notifyAgentChanged();
          result = null;
          break;
        }
        case AcpExtMethod.AgentSwitch: {
          const p = params as { agentId?: string };
          const agentId = p?.agentId;
          if (!agentId) throw new Error("agentId is required");
          const agent = this.agents.find((a) => a.id === agentId);
          if (!agent) throw new Error(`Agent not found: ${agentId}`);
          // Return immediately — the actual stop/respawn happens in the
          // background. Progress (agent changed, spawn errors) is delivered
          // via `_agent/changed` and error broadcasts over SSE.
          result = { agentId };
          void this.doSwitchAgent(agent).catch(() => {});
          break;
        }
        case AcpExtMethod.AgentReload: {
          const agentId = this.currentAgentId;
          if (!agentId) throw new Error("No active agent to reload");
          const agent = this.agents.find((a) => a.id === agentId) ?? null;
          result = { agentId };
          void this.doSwitchAgent(agent).catch(() => {});
          break;
        }
        case AcpExtMethod.AgentCurrent:
          result = { agentId: this.currentAgentId };
          break;
        default:
          error = { code: -32601, message: `Method not found: ${method}` };
      }
    } catch (e) {
      error = {
        code: -32603,
        message: e instanceof Error ? e.message : String(e),
      };
    }

    // Broadcast the response via SSE.
    const response =
      error !== null
        ? { jsonrpc: "2.0", id, error }
        : { jsonrpc: "2.0", id, result };
    this.broadcast(JSON.stringify(response));
  }

  private generateUniqueAgentId(): string {
    const existing = new Set(this.agents.map((a) => a.id));
    let n = 1;
    let candidate = `agent-${n}`;
    while (existing.has(candidate)) {
      n += 1;
      candidate = `agent-${n}`;
    }
    return candidate;
  }

  /**
   * Switch the active agent: stop the current process, update the command,
   * and respawn. If the target agent fails to start, automatically try the
   * remaining agents in order until one succeeds (or all fail).
   */
  private async doSwitchAgent(agent: AgentConfig | null): Promise<void> {
    if (!agent) {
      await this.stopAgent();
      return;
    }

    // Build the candidate list: start from the requested agent, then wrap
    // around to try every other agent.
    const idx = this.agents.findIndex((a) => a.id === agent.id);
    const candidates =
      idx >= 0
        ? [...this.agents.slice(idx), ...this.agents.slice(0, idx)]
        : [agent];

    // Keep SSE connections alive during agent switching.
    await this.stopAgent(false);

    for (const candidate of candidates) {
      this.agentCommand = candidate.command;
      this.agentArgs = candidate.args ?? [];
      this.agentCwd = candidate.cwd;
      this.currentAgentId = candidate.id;
      this.notifyAgentChanged();

      if (this.connections.size > 0) {
        const ok = await this.trySpawnAgent();
        if (ok) return; // Success — done.
        // Spawn failed — broadcast and try the next candidate.
        this.broadcastError(
          `Agent "${candidate.name}" failed to start, trying next...`,
        );
        await this.stopAgent(false);
      } else {
        return; // No connections — don't spawn now.
      }
    }

    // All candidates failed.
    this.broadcastError("All agents failed to start.");
  }

  /** Broadcast `_agent/changed` notification and fire the callback. */
  private notifyAgentChanged(): void {
    const notification = {
      jsonrpc: "2.0",
      method: AcpExtNotification.AgentChanged,
      params: {
        agents: this.agents,
        currentAgentId: this.currentAgentId,
      },
    };
    this.broadcast(JSON.stringify(notification));
    this.options.onAgentChanged?.(this.agents, this.currentAgentId);
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
        this.log(`idle timeout (${this.idleTimeout}ms) — stopping agent`);
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
    this.log(`agent not running (proc=${!!this.proc} exited=${this.procExited}) — respawning`);
    this.spawnPromise = (async () => {
      try {
        this.spawnAgent(this.agentCommand, this.agentArgs, this.agentCwd);
      } finally {
        this.spawnPromise = undefined;
      }
    })();
    return this.spawnPromise;
  }

  /** Check if the agent process stdin is ready to accept writes. */
  private isStdinReady(): boolean {
    return !!(
      this.proc &&
      !this.proc.killed &&
      !this.procExited &&
      this.proc.stdin &&
      !this.proc.stdin.destroyed &&
      this.procReady
    );
  }

  /** Flush any stdin data buffered while the agent was not yet ready. */
  private flushPendingStdin(): void {
    if (this.pendingStdinBuffers.length === 0) return;
    const buffers = this.pendingStdinBuffers;
    this.pendingStdinBuffers = [];
    const combined = Buffer.concat(buffers);
    if (this.isStdinReady()) {
      this.log(`flushing ${combined.length} bytes of pending stdin data`);
      this.writeToStdin(combined).catch(() => {
        this.broadcastError("Failed to flush pending stdin data");
      });
    } else {
      this.log(`flush skipped — stdin not ready, re-buffering ${combined.length} bytes`);
      this.pendingStdinBuffers.push(combined);
    }
  }

  /**
   * Spawn the agent and wait until it produces its first stdout line (success)
   * or errors/exits (failure). Used during agent switching to decide whether
   * to try the next candidate.
   */
  private trySpawnAgent(timeoutMs = 10000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.spawnAgent(this.agentCommand, this.agentArgs, this.agentCwd);

      const proc = this.proc;
      if (!proc) {
        resolve(false);
        return;
      }

      let settled = false;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };

      // Success: process emits at least one stdout line.
      const rl = createInterface({
        input: proc.stdout!,
        crlfDelay: Infinity,
      });
      rl.once("line", () => finish(true));

      // Failure: process errors or exits before producing output.
      proc.once("error", () => finish(false));
      proc.once("exit", () => finish(false));

      const timer = setTimeout(() => finish(false), timeoutMs);
    });
  }

  private async stopAgent(closeConnections = true): Promise<void> {
    this.log(`stopAgent (closeConnections=${closeConnections})`);
    // Always clean up idle check and (optionally) connections, even if the
    // process already exited.
    this.stopIdleCheck();
    if (closeConnections) {
      this.closeAllConnections();
    }
    this.pendingStdinBuffers = [];

    if (!this.proc || this.procExited) return;

    this.agentStoppedIntentionally = true;
    this.activePrompts.clear();

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
    this.log(`SSE client disconnected (total: ${this.connections.size})`);
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
