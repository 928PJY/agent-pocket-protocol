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
   *
   * @requires messages.sync_boundary
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
   * @requires messages.seq_authoritative
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

  /**
   * History pagination uses daemon-side timestamp (epoch ms) as cursor
   * instead of `session_seq`. When a peer announces this cap:
   *   - phone may set `since_ms` on `get_history` and `last_ms` on each
   *     `sync_request.cursors[]` entry,
   *   - daemon emits `tail_ms` on `session_history` and on
   *     `sync_complete.delivered[]`, and may emit `expected_tail_ms`
   *     plus `reason: 'tail_ms_mismatch'` on `history_divergence`,
   *   - phone may set `tail_ms` / `head_ms` on `verify_history`.
   *
   * Ordering contract: under this cap the daemon sorts each history
   * page by (timestamp_ms ASC, JSONL physical row index ASC) and the
   * phone trusts that order verbatim — no client-side re-sort. The
   * second key handles same-ms clusters (assistant content blocks,
   * synthetic permission_request markers) by reusing the SDK's
   * happens-before order from the JSONL file. Rows lacking a source
   * timestamp are filled with `prev_row_ms + 1` and the normalised ms
   * is what appears on the wire.
   *
   * Peers that lack this cap stay on the seq-based fields. The two are
   * additive on the wire and can coexist during rollout — the receiver
   * uses the cursor it understands and ignores the rest.
   *
   * Why: phone-side sort/dedup that depended on `session_seq` proved
   * fragile because the daemon does not always populate sdk_uuid on
   * tool_use rows. Switching the cursor to timestamp lets the phone
   * trust daemon emission order verbatim instead of reconstructing
   * order from a per-row seq the daemon may not have.
   */
  HISTORY_CURSOR_MS: 'history.cursor_ms',

  /**
   * Daemon extracts Codex transcript meta-tags from assistant/developer
   * message text and re-emits them as structured ClaudeEvents instead of
   * leaving the raw tags inline. Covers:
   *   - `<environment_context>`   → CodexEnvironmentContextEvent
   *   - `<collaboration_mode>`    → CodexCollaborationModeEvent
   *   - `<skills_instructions>`   → CodexSkillsListingEvent
   *   - `<system-reminder>`       → CodexSystemReminderEvent
   *   - `<oai-mem-citation>`      → CodexMemCitationEvent
   *
   * Under this cap the daemon strips recognised tags from the originating
   * message text before forwarding, so the phone renders clean prose plus
   * dedicated sub-events. Unrecognised tags are left inline (no data loss).
   *
   * When the peer (phone) lacks this cap, the daemon must keep emitting
   * the raw message text with tags inline — old iOS builds render them
   * as literal text and have no UI for the structured events.
   *
   * Only applies to `agent_type === 'codex'` sessions; Claude Code's
   * `<command-name>` / `<local-command-stdout>` path is unaffected and
   * still gated by PEER_CAPABILITIES.LOCAL_COMMAND.
   */
  CODEX_TAG_EXTRACTION: 'codex.tag_extraction',

  /**
   * Daemon attaches `turnMetrics` to the `AssistantMessageEvent` whose JSONL
   * row carries `stop_reason === 'end_turn'` (the last message of a turn).
   * Phone renders the metrics as a chip on that message bubble.
   *
   * Why: the legacy Stop-hook path only fired in observer mode (controller
   * mode uses the SDK and has no hooks), so controller sessions never
   * showed metrics. End_turn is detected in session-observer for BOTH
   * modes, so attaching there gives uniform coverage and removes the 500ms
   * ordering hack the Stop-hook path needed.
   *
   * Backwards-compat: when the peer (phone) lacks this cap, the daemon
   * must omit `turnMetrics` AND keep emitting the legacy
   * `output_type: 'completion_metrics'` session_output for that turn.
   * When both sides have the cap, the daemon stops emitting the legacy
   * frame so the chip is not duplicated.
   *
   * Notifications: completion notification text no longer includes the
   * metrics subtitle on either path — phones surface the chip in chat
   * instead.
   */
  MESSAGES_TURN_METRICS: 'messages.turn_metrics',
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
  PEER_CAPABILITIES.HISTORY_CURSOR_MS,
  PEER_CAPABILITIES.MESSAGES_TURN_METRICS,
  PEER_CAPABILITIES.CODEX_TAG_EXTRACTION,
];
