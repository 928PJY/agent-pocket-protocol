// Agent Pocket — Relay control-frame schema
//
// Control frames travel as cleartext JSON between a peer and the relay.
// The relay inspects them and either handles them locally (`hello`,
// `peer_status_query`, push-token registration) or forwards them to the
// opposite peer (`peer_status`, `peer_hello`). They are NOT part of the
// E2E-encrypted PcEvent / PhoneCommand stream — `RelayEnvelope` carries
// that traffic and is opaque to the relay.
//
// `peer_hello` was historically sent inside the E2E channel as a
// `PeerHello` PcEvent. As of protocol 0.6.0 it is promoted to a relay
// control frame so the relay can cache the most recent advertisement per
// pair and replay it to whichever peer comes online next. This makes
// capability negotiation a *state* the relay owns rather than an *event*
// that fires once per connect transition — eliminating the daemon-restart
// race where the phone never re-emits hello and the daemon's capability
// set stays empty.

/** Wire literal that identifies a relay-control frame. */
export const RELAY_CONTROL_TYPE = '__relay_control' as const;

/** Every action the relay-control envelope can carry. */
export type RelayControlAction =
  | 'hello'
  | 'rate_limited'
  | 'peer_status'
  | 'peer_status_query'
  | 'jwt_refresh'
  | 'register_push_token'
  | 'unregister_push_token'
  | 'peer_hello'
  | 'clock_sync';

/**
 * Common envelope shape for every relay-control frame. Concrete frames
 * narrow `action` and add their own fields.
 */
export interface RelayControlFrame {
  type: typeof RELAY_CONTROL_TYPE;
  action: RelayControlAction;
  [key: string]: unknown;
}

/**
 * Capability-and-version advertisement carried over the relay-control
 * channel. Field shape mirrors the legacy `PeerHello` PcEvent so handlers
 * can reuse the same parsing code; the wire envelope differs (control
 * frame vs E2E PcEvent).
 *
 * Both sides send their own `peer_hello` once on (re)connect. The relay
 * persists the most recent frame per pair and replays the *opposite*
 * peer's cached frame to whichever side comes online — see
 * `relay-server`'s `replayCachedPeerHello` helper.
 */
export interface PeerHelloControlFrame extends RelayControlFrame {
  action: 'peer_hello';
  product: 'app' | 'daemon';
  product_version: string;
  wire_version: number;
  capabilities: string[];
  sent_at: number;
  /** Protocol profile (v1.0+). When set, caps in the profile are implied. */
  profile?: string;
  /** Peer preferences for session output behaviour. */
  preferences?: import('./protocol.js').PeerPreferences;
}

/** Type guard for inbound dispatch on either peer or relay. */
export function isPeerHelloControlFrame(
  frame: RelayControlFrame,
): frame is PeerHelloControlFrame {
  return (
    frame.action === 'peer_hello' &&
    typeof (frame as PeerHelloControlFrame).product === 'string' &&
    typeof (frame as PeerHelloControlFrame).product_version === 'string' &&
    typeof (frame as PeerHelloControlFrame).wire_version === 'number' &&
    Array.isArray((frame as PeerHelloControlFrame).capabilities) &&
    typeof (frame as PeerHelloControlFrame).sent_at === 'number'
  );
}

/**
 * Relay-authoritative clock sync frame. Pushed by the relay periodically
 * (every ~5 minutes) after hello. Peers use `server_time_ms` to compute
 * their local clock offset for display_at rendering and timeout calculations.
 *
 * `monotonic_offset_hint_ms` is the relay's estimate of how far the peer's
 * clock is ahead of the relay (positive = peer is fast). Peers MAY ignore it
 * and compute their own offset from `server_time_ms - Date.now()`.
 */
export interface RelayClockSyncFrame extends RelayControlFrame {
  action: 'clock_sync';
  server_time_ms: number;
  monotonic_offset_hint_ms: number;
}
