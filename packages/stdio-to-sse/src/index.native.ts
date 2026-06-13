/**
 * React Native entry point for `@hermit/stdio-to-sse`.
 *
 * Metro's platform-specific extension resolution will prefer `.native.ts`
 * over `.ts` when bundling for React Native. This entry re-exports only the
 * client and the protocol utilities, avoiding Node.js built-in modules that
 * the server implementation depends on.
 */

export * from "./sse";
export * from "./client";
