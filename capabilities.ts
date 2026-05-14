// Peer capability identifiers exchanged between daemon and app over the
// E2E-encrypted channel. Relay never sees these.
//
// Capabilities are a flat set of opaque strings. Adding a new feature =
// adding a new constant here + having the producing side announce it in
// its peer_hello and the consuming side gate on peerCapabilities.has(X).
//
// Never remove a constant until no deployed peer can possibly still
// announce it; instead mark it deprecated and stop gating on it.

export const PEER_CAPABILITIES = {
  /**
   * Daemon supports the verify_history command (introduced PR #39).
   * App must skip the call when this is absent or the daemon will log
   * a "Unknown command type" error.
   */
  HISTORY_VERIFY: 'history.verify',

  /**
   * Daemon emits MessageAckEvent for SendMessageCommands carrying a
   * client_message_id (introduced PR #39). When absent, the app must
   * not block UI on ack arrival — old daemons will never send one.
   */
  MESSAGE_ACKS: 'messages.delivery_acks',

  /**
   * Peers understand explicit per-session agent identity fields such as
   * agent_type, agent_display_name, and agent_version.
   */
  AGENT_IDENTITY: 'agent.identity',

  /** Daemon can list and read local Codex sessions in observe mode. */
  CODEX_OBSERVE: 'codex.observe',

  /** Daemon can inject user text into an attached terminal session. */
  TERMINAL_REMOTE_MESSAGE: 'terminal.remote_message',

  /** Daemon can send an interrupt key sequence to an attached terminal. */
  TERMINAL_INTERRUPT: 'terminal.interrupt',

  /** Completion events include a stable per-turn request id for deduplication. */
  COMPLETION_REQUEST_ID: 'completion.request_id',

  /**
   * Daemon supports the explicit sync_request / sync_complete handshake
   * for deterministic backfill boundaries on reconnect. When absent, the
   * phone falls back to applying buffered messages as they arrive (which
   * causes UI flicker during long backfills).
   */
  SYNC_BOUNDARY: 'messages.sync_boundary',

  /**
   * Phone acknowledges delivery/processing of high-priority notification-capable
   * events so daemon retry is based on receipt, not relay online state.
   */
  NOTIFICATION_DELIVERY_ACKS: 'notifications.delivery_acks',

  /**
   * Daemon understands `set_permission_mode` and `set_model` commands for
   * controller-mode sessions and replies with `command_ack` (or `error`).
   * Old daemons would log "Unknown command type" — phone must gate the
   * picker UI on this capability.
   */
  SESSION_CONTROL: 'session.control',

  /**
   * Daemon enabled `enableFileCheckpointing` on its SDK Query and accepts
   * `rewind_session { user_message_id, dry_run? }`, replying with a
   * `rewind_session_response` event. On non-dry-run apply the daemon
   * forks the SDK session (transcript truncated inclusive of the target
   * message) and the response carries the new `session_id` to navigate
   * to. Phone must hide the rewind affordance when this cap is absent —
   * old daemons would log "Unknown command type".
   */
  SESSION_REWIND: 'session.rewind',

  /**
   * Daemon parses observer-mode JSONL `<command-name>` /
   * `<local-command-stdout>` / `<local-command-stderr>` entries plus
   * `compact_boundary` system frames and `isCompactSummary` user frames
   * into structured `local_command_invoke`, `local_command_output`,
   * `compact_boundary`, and `compact_summary` ClaudeEvents.
   *
   * When the peer (phone) lacks this cap, the daemon must continue to
   * silently drop these JSONL entries via `isInternalMessage` so old
   * iOS builds don't receive payloads they can't render.
   */
  LOCAL_COMMAND: 'local.command',

  /**
   * Both sides agree on a stable per-row identifier:
   *   - Daemon stamps `sdk_uuid` (and `sdk_block_index` for multi-block rows)
   *     on every emitted ClaudeEvent — JSONL row uuid where available, a
   *     deterministic sha1-derived id otherwise.
   *   - Daemon switches assistant text + thinking from delta-emit to
   *     full-text-emit (so each (sdk_uuid, sdk_block_index) row replaces
   *     in place rather than appending chunks).
   *   - Phone uses sdk_uuid as `ChatMessage.id` and drops fingerprint-
   *     based dedup entirely.
   *
   * Cap is announced by both sides; the daemon gates the delta→full-text
   * switch on the phone announcing it (old phones keep getting deltas).
   */
  STABLE_SDK_UUID: 'sdk.stable_uuid',

  /**
   * Daemon emits `sync_ack` immediately on receiving a `sync_request`,
   * before any backfill IO. Carries per-session `estimated_messages` so
   * the phone can replace its fixed 30s `force-flush` timer with a
   * size-aware budget. Also lets the phone fail fast (no_ack) when
   * `sync_request` is buffered behind an offline daemon — instead of
   * blocking the staging buffer for the full 30s.
   *
   * Daemon also emits `session_history_done` per session as it finishes
   * each one, so the phone can advance progress without waiting on the
   * single trailing `sync_complete` frame.
   */
  SYNC_ACK: 'messages.sync_ack',
} as const;

export type PeerCapability = typeof PEER_CAPABILITIES[keyof typeof PEER_CAPABILITIES];

/**
 * Capabilities this build of the daemon/app announces in its peer_hello.
 * Both sides happen to support both today, so the list is identical.
 */
export const CURRENT_PEER_CAPABILITIES: PeerCapability[] = [
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
];
