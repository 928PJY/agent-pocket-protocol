// Agent Pocket — Protocol Profiles (v1.0)
//
// Profiles bundle sets of capabilities into named presets. When a peer
// advertises a `profile` in its peer_hello, the other side treats all caps
// in that profile as implicitly announced. The explicit `capabilities` array
// then acts as an override layer (include/exclude on top of the profile).
//
// This reduces the combinatorial explosion of 25+ individual caps to a
// small set of well-tested profiles, while preserving per-cap granularity
// for edge cases.

import { PEER_CAPABILITIES } from './capabilities.js';

/**
 * v1-baseline: capabilities that existed before v0.7.0 (the "stable" set
 * that every production peer should support).
 */
const V1_BASELINE_CAPS = [
  PEER_CAPABILITIES.HISTORY_VERIFY,
  PEER_CAPABILITIES.MESSAGE_ACKS,
  PEER_CAPABILITIES.AGENT_IDENTITY,
  PEER_CAPABILITIES.CODEX_OBSERVE,
  PEER_CAPABILITIES.TERMINAL_REMOTE_MESSAGE,
  PEER_CAPABILITIES.TERMINAL_INTERRUPT,
  PEER_CAPABILITIES.COMPLETION_REQUEST_ID,
  PEER_CAPABILITIES.SYNC_BOUNDARY,
  PEER_CAPABILITIES.NOTIFICATION_DELIVERY_ACKS,
  PEER_CAPABILITIES.SESSION_CONTROL,
  PEER_CAPABILITIES.SESSION_REWIND,
  PEER_CAPABILITIES.LOCAL_COMMAND,
  PEER_CAPABILITIES.STABLE_SDK_UUID,
  PEER_CAPABILITIES.SYNC_ACK,
] as const;

/**
 * v1-precise: baseline + seq-authoritative + precise divergence + sync
 * enhancements. The "recommended" profile for peers that have implemented
 * the v0.6.3+ session_seq contract.
 */
const V1_PRECISE_CAPS = [
  ...V1_BASELINE_CAPS,
  PEER_CAPABILITIES.MESSAGES_SEQ_AUTHORITATIVE,
  PEER_CAPABILITIES.MESSAGES_PRECISE_DIVERGENCE,
  PEER_CAPABILITIES.SYNC_TIMEOUT_HINT,
  PEER_CAPABILITIES.SYNC_PRIORITY_SESSION,
  PEER_CAPABILITIES.PERMISSION_RESPONSE_ACK,
  PEER_CAPABILITIES.MESSAGE_ACK_TURN_STARTED,
  PEER_CAPABILITIES.COMMAND_ACK_EFFECTIVE_AT,
  PEER_CAPABILITIES.SESSION_HISTORY_CHUNKED,
  PEER_CAPABILITIES.MESSAGE_ID_IDEMPOTENT,
] as const;

/**
 * v1-full: all capabilities through v1.0. The "kitchen sink" profile for
 * peers that implement everything.
 */
const V1_FULL_CAPS = [
  ...V1_PRECISE_CAPS,
  PEER_CAPABILITIES.WAKE_BLOB_KEY_EPOCH,
  PEER_CAPABILITIES.OFFLINE_OVERFLOW,
  PEER_CAPABILITIES.SIGNED_COMMANDS,
  PEER_CAPABILITIES.SESSION_LINEAGE,
  PEER_CAPABILITIES.VERIFY_TAIL_HASH,
  PEER_CAPABILITIES.EMERGENCY_ABORT_SCOPED,
] as const;

export const PROTOCOL_PROFILES = {
  V1_BASELINE: {
    name: 'v1-baseline',
    caps: V1_BASELINE_CAPS,
  },
  V1_PRECISE: {
    name: 'v1-precise',
    caps: V1_PRECISE_CAPS,
  },
  V1_FULL: {
    name: 'v1-full',
    caps: V1_FULL_CAPS,
  },
} as const;

export type ProtocolProfileName = typeof PROTOCOL_PROFILES[keyof typeof PROTOCOL_PROFILES]['name'];

/**
 * Resolve a profile name to its cap set. Returns undefined for unknown
 * profiles (forward-compat: new profiles added in future minors).
 */
export function resolveProfile(name: string): readonly string[] | undefined {
  for (const p of Object.values(PROTOCOL_PROFILES)) {
    if (p.name === name) return p.caps;
  }
  return undefined;
}
