/**
 * Transport abstraction shared between web and React Native.
 *
 * Both platforms provide a `{ stdin, stdout }` pair backed by an SSE gateway:
 *   - `stdout` yields the agent's stdout lines (server -> client stream)
 *   - `stdin.write` posts a line to the agent's stdin (client -> server)
 *
 * Concrete implementations live in each app:
 *   - web:    `apps/web/src/transport/stdio.ts` (fetch streaming)
 *   - mobile: `@hermit-org/stdio-to-sse_rn` `createStdioLikeSse`
 */
export interface StdioTransport {
  stdout: AsyncIterable<string>;
  stdin: {
    write(line: string): Promise<void>;
  };
  connect(): Promise<void>;
  disconnect(): void;
}
