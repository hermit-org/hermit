/**
 * React Native transport layer that turns an SSE endpoint into a stdio-like
 * readable stream.
 *
 * This package is intentionally environment-agnostic: it does not import any
 * Node.js built-ins. It depends on `react-native-sse` for the actual SSE
 * socket implementation.
 */

export * from "./types";
export * from "./framing";
export * from "./http";
export * from "./stdio";
export { RnSseConnection } from "./connection";
