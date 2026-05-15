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

  /**
   * `session_seq` is the authoritative per-session monotonic sequence number
   * for ALL messages — historical and live — and is the ONLY valid sort key.
   * `timestamp` is for display only and must not be used for ordering.
   *
   * When this cap is announced by the daemon:
   *   - Every history message (in `session_history.messages[]`) carries
   *     `session_seq` (top-level field; the legacy `seq` field is also set
   *     for back-compat with old phones).
   *   - `session_seq` values are stable across daemon restarts and JSONL
   *     re-parses: a given `sdk_uuid` keeps the same `session_seq` forever.
   *   - History `session_seq` and live `SessionOutputEvent.session_seq`
   *     share the same allocator (both come from a per-session persisted
   *     `seqmap` keyed on `sdk_uuid`).
   *   - During a sync window (`sync_request` → `sync_complete`), the daemon
   *     guarantees that backfilled `session_history` frames cover every
   *     `session_seq` strictly greater than the phone's `known_seqs[id]` and
   *     less-or-equal to `sync_complete.delivered[].last_seq`. Real-time
   *     `session_output` events with seq > `last_seq` are still delivered
   *     in flight; the phone uses `last_seq` to fold them in correctly.
   *
   * When this cap is absent the phone falls back to the legacy
   * `(timestamp, seq?)` ordering and tolerates seq churn across daemon
   * restarts.
   */
  MESSAGES_SEQ_AUTHORITATIVE: 'messages.seq_authoritative',

  /**
   * `session_list` items carry `tail_seq` (the daemon's allocator high-water
   * mark for that session), and `verify_history` / `history_divergence`
   * exchanges are evaluated against the phone's **on-disk** count and tail.
   *
   * Together these let two flows converge that previously couldn't:
   *   - `loadInitialMessages` skips the network entirely when the phone's
   *     disk tail equals the daemon's `tail_seq` for that session.
   *   - `history_divergence` is followed up with a precise
   *     `get_history { since_seq = disk_tail }` instead of a blind
   *     `requestFullHistory` (which can never close a gap larger than the
   *     daemon's wire-window default of 30 parents).
   *
   * When this cap is absent on the daemon, the phone keeps using the
   * legacy "always request, blind full refetch" behaviour.
   */
  MESSAGES_PRECISE_DIVERGENCE: 'messages.precise_divergence',

  // ---- v0.7.0 capabilities ----

  /**
   * Daemon includes `timeout_hint_ms` in `sync_ack`, allowing the phone to
   * use a size-aware staging timeout instead of the fixed 30s fallback.
   *
   * @requires messages.sync_ack
   */
  SYNC_TIMEOUT_HINT: 'messages.sync_timeout_hint',

  /**
   * Phone can set `priority_session_id` on `sync_request` to have the daemon
   * emit that session's pending events (permissions, status) before the bulk
   * backfill. Intended for APNs-wake scenarios.
   *
   * @requires messages.sync_boundary
   */
  SYNC_PRIORITY_SESSION: 'messages.sync_priority_session',

  /**
   * Daemon emits `permission_response_ack` immediately when it processes a
   * phone's permission_response command, so the phone can exit the approve
   * button spinner without waiting for the slower session_status transition.
   */
  PERMISSION_RESPONSE_ACK: 'permissions.response_ack',

  /**
   * Daemon emits `message_ack { status: 'turn_started' }` when the first
   * assistant token / stream chunk arrives for a phone-sent message. Lets
   * the phone show "Claude is typing..." feedback keyed to the specific
   * message rather than relying on session_status alone.
   *
   * @requires messages.delivery_acks
   */
  MESSAGE_ACK_TURN_STARTED: 'messages.ack_turn_started',

  /**
   * Daemon includes `effective_at` (epoch ms) in `command_ack`, giving
   * phones the daemon-authoritative timestamp of when the command took
   * effect (as opposed to when the phone sent it or the relay routed it).
   *
   * @requires session.control
   */
  COMMAND_ACK_EFFECTIVE_AT: 'session.control.effective_at',

  /**
   * Daemon prefixes wake_blob ciphertext with 1 byte key_epoch before
   * encrypting. NSE uses this to detect key mismatch and fallback to
   * generic copy rather than showing decrypt-failure garbage.
   */
  WAKE_BLOB_KEY_EPOCH: 'wake.key_epoch',

  /**
   * Relay injects `offline_overflow` events when FIFO eviction drops
   * buffered messages for a pair. Phone should trigger verify_history +
   * get_history on receipt.
   *
   * Note: unlike other caps, this is announced/gated by the relay (or
   * the peer acting on behalf of relay awareness), not by the daemon.
   * The "peer" for this cap is the relay infrastructure itself.
   */
  OFFLINE_OVERFLOW: 'relay.offline_overflow',

  /**
   * Daemon supports chunked session history delivery: when sync_ack
   * carries `chunked: true`, history is delivered as multiple
   * `session_history_chunk` frames (each ≤50 messages) per session,
   * terminated by `session_history_done`.
   *
   * @requires messages.sync_ack
   */
  SESSION_HISTORY_CHUNKED: 'messages.session_history_chunked',

  /**
   * Daemon guarantees 5-minute idempotency window for
   * `SendMessageCommand.client_message_id`. Within the window, duplicate
   * ids get an ack without re-injection.
   *
   * @requires messages.delivery_acks
   */
  MESSAGE_ID_IDEMPOTENT: 'messages.id_idempotent',

  // ---- v0.8.0 capabilities ----

  /**
   * Both sides support signed command variants (SignedSetPermissionModeCommand,
   * SignedSetModelCommand, SignedKillSessionCommand, SignedRewindSessionCommand).
   * When daemon announces this, phone should prefer signed variants over legacy
   * unsigned commands for all side-effecting operations.
   */
  SIGNED_COMMANDS: 'security.signed_commands',

  /**
   * Daemon emits `session_replaced` events and populates
   * `SessionInfo.parent_session_id` / `forked_at_seq` for forked sessions.
   * Phone uses this for lineage UI and to clean up pending state on old sessions.
   */
  SESSION_LINEAGE: 'session.lineage',

  /**
   * Daemon supports `verify_history.tail_n_uuid_hash` for content-level
   * divergence detection (catches corruption even when count/tail_seq agree).
   *
   * @requires history.verify
   */
  VERIFY_TAIL_HASH: 'history.verify_tail_hash',

  /**
   * Daemon supports `emergency_abort.session_ids` for scoped abort (kill only
   * specific sessions instead of all). When absent, phone omits the field
   * and daemon kills everything (legacy behaviour).
   */
  EMERGENCY_ABORT_SCOPED: 'emergency.abort_scoped',
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
  PEER_CAPABILITIES.MESSAGES_SEQ_AUTHORITATIVE,
  PEER_CAPABILITIES.MESSAGES_PRECISE_DIVERGENCE,
  PEER_CAPABILITIES.SYNC_TIMEOUT_HINT,
  PEER_CAPABILITIES.SYNC_PRIORITY_SESSION,
  PEER_CAPABILITIES.PERMISSION_RESPONSE_ACK,
  PEER_CAPABILITIES.MESSAGE_ACK_TURN_STARTED,
  PEER_CAPABILITIES.COMMAND_ACK_EFFECTIVE_AT,
  PEER_CAPABILITIES.WAKE_BLOB_KEY_EPOCH,
  PEER_CAPABILITIES.OFFLINE_OVERFLOW,
  PEER_CAPABILITIES.SESSION_HISTORY_CHUNKED,
  PEER_CAPABILITIES.MESSAGE_ID_IDEMPOTENT,
  PEER_CAPABILITIES.SIGNED_COMMANDS,
  PEER_CAPABILITIES.SESSION_LINEAGE,
  PEER_CAPABILITIES.VERIFY_TAIL_HASH,
  PEER_CAPABILITIES.EMERGENCY_ABORT_SCOPED,
];
