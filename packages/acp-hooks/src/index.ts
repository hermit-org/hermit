/**
 * @hermit-org/acp-hooks
 *
 * Shared, platform-agnostic React hooks and state for the Hermit ACP client.
 * This package contains the ACP business logic used by both the web and mobile
 * apps. It depends on `@hermit-org/acp` for the protocol client and accepts
 * platform-specific adapters for storage and ACP client state.
 */

export * from "./domain";
export * from "./archive";
export * from "./permissionStore";
export * from "./useAcpPageAdapter";
export * from "./useArchivedSessions";
export * from "./useOpenSessions";
export * from "./types";
