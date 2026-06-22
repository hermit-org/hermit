/**
 * Public API entry point for `@hermit-org/stdio-to-sse`.
 *
 * This package bridges a stdio-based program to an HTTP POST -> SSE endpoint.
 * It exposes a server that spawns a child process and streams its stdout as
 * Server-Sent Events, plus a client that consumes those events.
 *
 * The implementation uses Node.js built-in modules, so it runs under both
 * Node.js (18+) and Bun.
 *
 * Types are defined alongside their implementations rather than in a central
 * types file, so exports are re-exported per module below.
 */

export * from "./sse";
export * from "./server";
export * from "./client";
