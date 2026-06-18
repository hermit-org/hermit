import type { StdioTransport } from "./transport";
import {
  createRequest,
  createNotification,
  createSuccessResponse,
  createErrorResponse,
  encodeMessage,
  isSuccessResponse,
  isErrorResponse,
  isRequest,
  isNotification,
  parseLine,
} from "./jsonrpc";
import {
  AcpMethod,
  AcpNotification,
  AcpServerMethod,
  PROTOCOL_VERSION,
  type ImplementationInfo,
  type ClientCapabilities,
  type InitializeParams,
  type InitializeResult,
  type SessionNewParams,
  type SessionLoadParams,
  type SessionResumeParams,
  type SessionSetupResult,
  type SessionCloseParams,
  type SessionPromptParams,
  type SessionPromptResult,
  type SessionSetModeParams,
  type SessionSetConfigOptionParams,
  type SessionSetConfigOptionResult,
  type SessionListParams,
  type SessionListResult,
  type SessionDeleteParams,
  type SessionCancelParams,
  type SessionUpdate,
  type SessionUpdateParams,
  type RequestPermissionParams,
  type RequestPermissionResult,
  type PermissionOutcome,
  type FsReadTextFileParams,
  type FsReadTextFileResult,
  type FsWriteTextFileParams,
  type TerminalCreateParams,
  type TerminalCreateResult,
  type TerminalOutputParams,
  type TerminalOutputResult,
  type TerminalWaitForExitParams,
  type TerminalWaitForExitResult,
  type TerminalReleaseParams,
  type TerminalKillParams,
  type JsonRpcRequest,
} from "./types";

/** Standard JSON-RPC error codes. */
const ERROR_CODE_METHOD_NOT_FOUND = -32601;
const ERROR_CODE_INTERNAL = -32603;

/**
 * Handlers for requests the Agent sends to the Client.
 *
 * Provide these to support `fs/*`, `terminal/*`, and
 * `session/request_permission`. Any handler left `undefined` responds with a
 * "method not found" error, which is correct per the spec when the Client does
 * not advertise the capability.
 */
export interface AcpClientHandlers {
  /** User authorization for tool calls (default: auto-reject). */
  requestPermission?: (
    params: RequestPermissionParams,
  ) => Promise<RequestPermissionResult>;
  fsReadTextFile?: (params: FsReadTextFileParams) => Promise<FsReadTextFileResult>;
  fsWriteTextFile?: (params: FsWriteTextFileParams) => Promise<null>;
  terminalCreate?: (params: TerminalCreateParams) => Promise<TerminalCreateResult>;
  terminalOutput?: (
    params: TerminalOutputParams,
  ) => Promise<TerminalOutputResult>;
  terminalWaitForExit?: (
    params: TerminalWaitForExitParams,
  ) => Promise<TerminalWaitForExitResult>;
  terminalRelease?: (params: TerminalReleaseParams) => Promise<null>;
  terminalKill?: (params: TerminalKillParams) => Promise<null>;
}

export interface AcpClientOptions {
  transport: StdioTransport;
  clientInfo?: ImplementationInfo;
  clientCapabilities?: ClientCapabilities;
  handlers?: AcpClientHandlers;
}

export interface AcpClient {
  /** Result of the last successful `initialize`. */
  initializeResult: InitializeResult | null;
  initialize(): Promise<InitializeResult>;
  authenticate(methodId: string): Promise<null>;
  logout(): Promise<null>;
  sessionNew(params: SessionNewParams): Promise<SessionSetupResult>;
  sessionLoad(params: SessionLoadParams): Promise<null>;
  sessionResume(params: SessionResumeParams): Promise<SessionSetupResult>;
  sessionClose(params: SessionCloseParams): Promise<null>;
  sessionPrompt(params: SessionPromptParams): Promise<SessionPromptResult>;
  sessionSetMode(params: SessionSetModeParams): Promise<null>;
  sessionSetConfigOption(
    params: SessionSetConfigOptionParams,
  ): Promise<SessionSetConfigOptionResult>;
  sessionList(params?: SessionListParams): Promise<SessionListResult>;
  sessionDelete(params: SessionDeleteParams): Promise<null>;
  sessionCancel(params: SessionCancelParams): Promise<void>;
  /** Subscribe to `session/update` notifications. */
  onUpdate(listener: (update: SessionUpdate) => void): () => void;
  disconnect(): void;
}

export function createAcpClient(options: AcpClientOptions): AcpClient {
  const { transport, clientInfo, clientCapabilities, handlers = {} } = options;

  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const updateListeners = new Set<(update: SessionUpdate) => void>();
  let reading = false;
  let initializeResult: InitializeResult | null = null;

  const sendNotification = async <T>(method: string, params?: T): Promise<void> => {
    const notification = createNotification<T>(method, params);
    await transport.stdin.write(encodeMessage(notification));
  };

  const request = async <P, R>(method: string, params?: P): Promise<R> => {
    const req = createRequest<P>(method, params);
    return new Promise<R>((resolve, reject) => {
      pending.set(req.id as number, {
        resolve: (value: unknown) => resolve(value as R),
        reject,
      });
      transport.stdin.write(encodeMessage(req)).catch((error: unknown) => {
        pending.delete(req.id as number);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  };

  const handleAgentRequest = async (req: JsonRpcRequest): Promise<void> => {
    const id = req.id;
    try {
      let result: unknown;
      switch (req.method) {
        case AcpServerMethod.SessionRequestPermission: {
          if (handlers.requestPermission) {
            result = await handlers.requestPermission(
              req.params as RequestPermissionParams,
            );
          } else {
            // Default: reject the request.
            result = {
              outcome: { outcome: "cancelled" } satisfies PermissionOutcome,
            } satisfies RequestPermissionResult;
          }
          break;
        }
        case AcpServerMethod.FsReadTextFile:
          if (!handlers.fsReadTextFile) throw new MethodNotFound(req.method);
          result = await handlers.fsReadTextFile(
            req.params as FsReadTextFileParams,
          );
          break;
        case AcpServerMethod.FsWriteTextFile:
          if (!handlers.fsWriteTextFile) throw new MethodNotFound(req.method);
          await handlers.fsWriteTextFile(req.params as FsWriteTextFileParams);
          result = null;
          break;
        case AcpServerMethod.TerminalCreate:
          if (!handlers.terminalCreate) throw new MethodNotFound(req.method);
          result = await handlers.terminalCreate(
            req.params as TerminalCreateParams,
          );
          break;
        case AcpServerMethod.TerminalOutput:
          if (!handlers.terminalOutput) throw new MethodNotFound(req.method);
          result = await handlers.terminalOutput(
            req.params as TerminalOutputParams,
          );
          break;
        case AcpServerMethod.TerminalWaitForExit:
          if (!handlers.terminalWaitForExit) throw new MethodNotFound(req.method);
          result = await handlers.terminalWaitForExit(
            req.params as TerminalWaitForExitParams,
          );
          break;
        case AcpServerMethod.TerminalRelease:
          if (!handlers.terminalRelease) throw new MethodNotFound(req.method);
          await handlers.terminalRelease(req.params as TerminalReleaseParams);
          result = null;
          break;
        case AcpServerMethod.TerminalKill:
          if (!handlers.terminalKill) throw new MethodNotFound(req.method);
          await handlers.terminalKill(req.params as TerminalKillParams);
          result = null;
          break;
        default:
          throw new MethodNotFound(req.method);
      }
      await transport.stdin.write(
        encodeMessage(createSuccessResponse(id, result)),
      );
    } catch (error) {
      const isMethodMissing = error instanceof MethodNotFound;
      const message = error instanceof Error ? error.message : String(error);
      await transport.stdin.write(
        encodeMessage(
          createErrorResponse(
            id,
            isMethodMissing ? ERROR_CODE_METHOD_NOT_FOUND : ERROR_CODE_INTERNAL,
            message,
          ),
        ),
      );
    }
  };

  const handleLine = (line: string): void => {
    const message = parseLine(line);
    if (!message) return;

    if (isNotification(message)) {
      if (message.method === AcpNotification.SessionUpdate) {
        const params = message.params as SessionUpdateParams | undefined;
        const update = params?.update;
        if (update) {
          for (const listener of updateListeners) {
            try {
              listener(update);
            } catch {
              // protect the client from consumer errors
            }
          }
        }
      }
      return;
    }

    if (isRequest(message)) {
      void handleAgentRequest(message);
      return;
    }

    if ("id" in message) {
      const resolver = pending.get(message.id as number);
      if (!resolver) return;
      pending.delete(message.id as number);

      if (isErrorResponse(message)) {
        resolver.reject(new Error(message.error.message));
      } else if (isSuccessResponse(message)) {
        resolver.resolve(message.result);
      }
    }
  };

  const startReader = async (): Promise<void> => {
    if (reading) return;
    reading = true;
    try {
      for await (const line of transport.stdout) {
        handleLine(line);
      }
    } finally {
      reading = false;
    }
  };

  const client: AcpClient = {
    get initializeResult() {
      return initializeResult;
    },

    async initialize(): Promise<InitializeResult> {
      await transport.connect();
      void startReader();
      const params: InitializeParams = {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: clientCapabilities ?? {},
        clientInfo: clientInfo
          ? { name: clientInfo.name, version: clientInfo.version ?? "0.0.0", title: clientInfo.title }
          : { name: "hermit-client", version: "0.0.0" },
      };
      const result = await request<InitializeParams, InitializeResult>(
        AcpMethod.Initialize,
        params,
      );
      initializeResult = result;
      return result;
    },

    authenticate: (methodId) =>
      request<{ methodId: string }, null>(AcpMethod.Authenticate, { methodId }),

    logout: () => request<unknown, null>(AcpMethod.Logout, {}),

    sessionNew: (params) =>
      request<SessionNewParams, SessionSetupResult>(AcpMethod.SessionNew, {
        mcpServers: [],
        ...params,
      }),

    sessionLoad: (params) =>
      request<SessionLoadParams, null>(AcpMethod.SessionLoad, {
        mcpServers: [],
        ...params,
      }),

    sessionResume: (params) =>
      request<SessionResumeParams, SessionSetupResult>(
        AcpMethod.SessionResume,
        { mcpServers: [], ...params },
      ),

    sessionClose: (params) =>
      request<SessionCloseParams, null>(AcpMethod.SessionClose, params),

    sessionPrompt: (params) =>
      request<SessionPromptParams, SessionPromptResult>(
        AcpMethod.SessionPrompt,
        params,
      ),

    sessionSetMode: (params) =>
      request<SessionSetModeParams, null>(AcpMethod.SessionSetMode, params),

    sessionSetConfigOption: (params) =>
      request<SessionSetConfigOptionParams, SessionSetConfigOptionResult>(
        AcpMethod.SessionSetConfigOption,
        params,
      ),

    sessionList: (params) =>
      request<SessionListParams | undefined, SessionListResult>(
        AcpMethod.SessionList,
        params,
      ),

    sessionDelete: (params) =>
      request<SessionDeleteParams, null>(AcpMethod.SessionDelete, params),

    async sessionCancel(params: SessionCancelParams): Promise<void> {
      await sendNotification<SessionCancelParams>(
        AcpNotification.SessionCancel,
        params,
      );
    },

    onUpdate(listener: (update: SessionUpdate) => void): () => void {
      updateListeners.add(listener);
      return () => updateListeners.delete(listener);
    },

    disconnect(): void {
      pending.forEach(({ reject }) => reject(new Error("Connection closed")));
      pending.clear();
      transport.disconnect();
    },
  };

  return client;
}

class MethodNotFound extends Error {
  constructor(method: string) {
    super(`Method not found: ${method}`);
    this.name = "MethodNotFound";
  }
}
