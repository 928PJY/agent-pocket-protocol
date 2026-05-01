// Relay-advertised feature flags. These describe optional __relay_control
// actions the relay supports beyond the baseline wire contract. Clients
// read the current set from GET /.well-known/agent-pocket (or from the
// relay's hello frame, once step 2 lands) and gate behavior accordingly.
//
// Unlike peer capabilities, these are server-side features and are not
// exchanged over the E2E channel.

export const RELAY_FEATURES = {
  GENERIC_WAKE_PUSH: 'generic_wake_push',
  JWT_REFRESH: 'jwt_refresh',
  PEER_STATUS: 'peer_status',
} as const;

export type RelayFeature = typeof RELAY_FEATURES[keyof typeof RELAY_FEATURES];

export const CURRENT_RELAY_FEATURES: RelayFeature[] = [
  RELAY_FEATURES.GENERIC_WAKE_PUSH,
  RELAY_FEATURES.JWT_REFRESH,
  RELAY_FEATURES.PEER_STATUS,
];
