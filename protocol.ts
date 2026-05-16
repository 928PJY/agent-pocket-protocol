// Agent Pocket — Shared Protocol Types
// All messages exchanged between iOS App ↔ Relay Server ↔ PC Daemon

// ============================================================================
// Connection Modes
// ============================================================================

export type ConnectionMode = 'relay' | 'lan';

export type AgentType = 'claude_code' | 'codex' | 'gemini' | 'unknown';

// ============================================================================
// Enums
// ============================================================================

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SessionStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  READY = 'ready',
  PENDING_ACTIONS = 'pending_actions',
  HISTORY = 'history',
  ERROR = 'error',
}

export enum PermissionDecision {
  APPROVE = 'approve',
  DENY = 'deny',
  ALWAYS_ALLOW = 'always_allow',
  APPROVE_MANUAL = 'approve_manual',
}

// ============================================================================
// NDJSON Event Types (Claude Code stdout)
// ============================================================================

export interface ThinkingEvent {
  type: 'thinking';
  thinking: string;
  /// SDK transcript UUID (top-level `uuid` from the JSONL row). When the
  /// daemon also announces PEER_CAPABILITIES.STABLE_SDK_UUID, `thinking`
  /// carries the full block text (not a delta slice) and the phone keys
  /// `ChatMessage.id` off (sdkUuid, sdkBlockIndex) so successive emits for
  /// the same row replace in place.
  sdkUuid?: string;
  /// 0-based index of this block inside `message.content[]` for the row.
  /// Disambiguates multiple thinking/text blocks that share one row uuid.
  sdkBlockIndex?: number;
}

export interface AssistantMessageEvent {
  type: 'assistant_message';
  message: string;
  /// See ThinkingEvent.sdkUuid — same semantics for assistant text blocks.
  sdkUuid?: string;
  sdkBlockIndex?: number;
}

export interface ToolUseEvent {
  type: 'tool_use';
  tool_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  /// SDK transcript UUID for the row that contained this tool_use block.
  /// Tool identity for dedup/permission/rewind still flows through
  /// `tool_id`; sdkUuid is informational here.
  sdkUuid?: string;
  /// 0-based index inside the source row's `message.content[]`.
  sdkBlockIndex?: number;
}

export interface ToolResultEvent {
  type: 'tool_result';
  tool_id: string;
  status: 'success' | 'error';
  output: string;
  /// SDK transcript UUID. Tool result identity is still keyed off
  /// `tool_id` end-to-end; sdkUuid is informational.
  sdkUuid?: string;
}

export interface PermissionRequestFromClaude {
  type: 'permission_request';
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export interface UserMessageEvent {
  type: 'user_message';
  message: string;
  /// SDK transcript UUID (top-level `uuid` from the JSONL row). Required by
  /// the phone to call `rewind_session { user_message_id }`. Omitted when the
  /// row has no uuid (older transcripts) or when the message did not originate
  /// from an SDK transcript row (e.g. queue-operation enqueues).
  sdkUuid?: string;
}

export interface SystemMessageEvent {
  type: 'system_message';
  message: string;
  /// SDK transcript UUID where available. Synthesized system_messages
  /// (e.g. interrupt notices that have no source JSONL row) get a
  /// deterministic id from the daemon's stableEventId helper instead.
  sdkUuid?: string;
}

export interface SubagentEvent {
  type: 'subagent_event';
  agent_id: string;
  agent_name: string;         // description from meta.json
  agent_type: string;         // e.g. "Explore", "code", etc.
  /// Omitted for status-only events (e.g. agent finished with no new content).
  inner_event?: ThinkingEvent | AssistantMessageEvent | ToolUseEvent | ToolResultEvent;
  tool_use_count?: number;
  token_count?: number;
  agent_status?: 'running' | 'idle' | 'done';
  /// SDK transcript UUID of the subagent JSONL row that produced this
  /// outer event. Informational — phone groups by `agent_id` and keys
  /// `ChatMessage.id` off `inner_event.sdkUuid`.
  sdkUuid?: string;
  /// Mirrors inner_event's block index when applicable.
  sdkBlockIndex?: number;
}

/**
 * User invoked a CLI slash command in the terminal (e.g. `/cost`, `/recap`,
 * `/compact`). Parsed from JSONL `<command-name>` entries. The matching
 * `LocalCommandOutputEvent` (if any) follows in a later session_seq frame —
 * the phone pairs them in its layout pass. Gated by
 * PEER_CAPABILITIES.LOCAL_COMMAND.
 */
export interface LocalCommandInvokeEvent {
  type: 'local_command_invoke';
  /// Command name without the leading slash (e.g. "cost", "compact").
  name: string;
  /// Args text after the command name; empty string when the user typed
  /// the command bare (e.g. `/cost` vs `/effort medium`).
  args: string;
  /// Source JSONL entry timestamp (ISO 8601). Lets the phone use the same
  /// timestamp for live and history-replayed instances of the same row, so
  /// dedup across paths matches.
  timestamp?: string;
  /// SDK transcript UUID of the source `<command-name>` row.
  sdkUuid?: string;
}

/**
 * Stdout (or stderr) produced by a CLI slash command. Parsed from JSONL
 * `<local-command-stdout>` / `<local-command-stderr>` entries. Pairs with
 * the most recent preceding `LocalCommandInvokeEvent` from the same
 * session. Gated by PEER_CAPABILITIES.LOCAL_COMMAND.
 */
export interface LocalCommandOutputEvent {
  type: 'local_command_output';
  /// Inner text of the tag, ANSI escapes preserved as-is — phone strips them.
  stdout: string;
  /// Set when sourced from `<local-command-stderr>` instead of stdout.
  is_stderr?: boolean;
  /// Source JSONL entry timestamp (ISO 8601). See LocalCommandInvokeEvent.
  timestamp?: string;
  /// SDK transcript UUID of the source `<local-command-stdout|stderr>` row.
  sdkUuid?: string;
  /// `parentUuid` from the source JSONL row — points at the matching
  /// `<command-name>` row's `uuid`. Lets the phone pair invoke + output
  /// even when ordering is non-monotonic (history backfill, multiple
  /// outputs interleaved). Falls back to arrival-order pairing when absent.
  parent_invoke_sdk_uuid?: string;
}

/**
 * Boundary marker emitted right after `/compact` finishes condensing the
 * conversation. Renders as a horizontal "Conversation compacted" divider
 * in chat. Gated by PEER_CAPABILITIES.LOCAL_COMMAND.
 */
export interface CompactBoundaryEvent {
  type: 'compact_boundary';
  /// Source JSONL entry timestamp (ISO 8601). See LocalCommandInvokeEvent.
  timestamp?: string;
  /// SDK transcript UUID of the source `compact_boundary` system frame.
  sdkUuid?: string;
}

/**
 * Auto-generated summary written to the new conversation context after
 * `/compact`. Carries the full multi-KB summary text as a single payload
 * so the phone can render it in a collapsed disclosure (default closed).
 * Gated by PEER_CAPABILITIES.LOCAL_COMMAND.
 */
export interface CompactSummaryEvent {
  type: 'compact_summary';
  summary: string;
  /// Source JSONL entry timestamp (ISO 8601). See LocalCommandInvokeEvent.
  timestamp?: string;
  /// SDK transcript UUID of the source `isCompactSummary` user frame.
  sdkUuid?: string;
}

export type ClaudeEvent =
  | ThinkingEvent
  | AssistantMessageEvent
  | ToolUseEvent
  | ToolResultEvent
  | PermissionRequestFromClaude
  | UserMessageEvent
  | SystemMessageEvent
  | SubagentEvent
  | LocalCommandInvokeEvent
  | LocalCommandOutputEvent
  | CompactBoundaryEvent
  | CompactSummaryEvent;

// ============================================================================
// Phone → PC Commands
// ============================================================================

export interface NewSessionCommand {
  type: 'new_session';
  request_id: string;
  config: {
    /// Human-readable session name shown on the phone session list.
    name: string;
    /// Which agent backend to drive. Currently 'claude_code' or 'codex'.
    agent_type: Extract<AgentType, 'claude_code' | 'codex'>;
    working_directory?: string;
    model?: string;
    system_prompt?: string;
    allowed_tools?: string[];
    /**
     * Launch the SDK Query with `allowDangerouslySkipPermissions: true` so the
     * session can later switch into `bypassPermissions` mode. Must be opted-in
     * at session-create time — the SDK does not allow flipping this at runtime.
     */
    dangerously_skip_permissions?: boolean;
  };
}

export interface ResumeSessionCommand {
  type: 'resume_session';
  request_id: string;
  session_id: string;
}

export interface SendMessageCommand {
  type: 'send_message';
  session_id: string;
  message: string;
  /**
   * Phone-generated UUID for this user message. The daemon echoes it back
   * in MessageAckEvent so the phone can transition the local message
   * state machine from sending → delivered → sent (or → failed).
   * Optional for backward compat with older phone clients.
   */
  client_message_id?: string;
}

export interface PermissionResponseCommand {
  type: 'permission_response';
  session_id: string;
  request_id: string;
  decision: PermissionDecision;
  phone_signature: string; // Ed25519 signature
  seq: number;
  timestamp: number;
}

export interface QuestionResponseCommand {
  type: 'question_response';
  session_id: string;
  request_id: string; // tool_use_id of the AskUserQuestion
  answers: Record<string, string>; // question text -> selected answer label
}

export interface KillSessionCommand {
  type: 'kill_session';
  session_id: string;
}

export interface InterruptSessionCommand {
  type: 'interrupt_session';
  session_id: string;
}

/**
 * Permission modes recognised by the SDK's `Query.setPermissionMode()`.
 * - `default` — prompt for every tool that needs approval.
 * - `acceptEdits` — auto-approve file edits, still prompt for higher-risk tools.
 * - `plan` — planning mode: Claude proposes edits without executing them.
 * - `bypassPermissions` — no prompts at all (caller is fully trusted). Requires
 *   the Query to have been launched with `allowDangerouslySkipPermissions: true`.
 * - `dontAsk` — never prompt; deny anything not pre-approved.
 * - `auto` — model classifier auto-approves/denies prompts.
 */
export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | 'dontAsk' | 'auto';

/**
 * Phone asks the daemon to switch the SDK Query's active permission mode.
 * Only valid for controller-mode (SDK-owned) sessions; observer mode
 * returns an `error` event with code `not_supported`.
 */
export interface SetPermissionModeCommand {
  type: 'set_permission_mode';
  request_id: string;
  session_id: string;
  mode: PermissionMode;
}

/**
 * Phone asks the daemon to switch the SDK Query's active model.
 * Pass `model: undefined` to reset to the SDK's default model.
 * Only valid for controller-mode (SDK-owned) sessions; observer mode
 * returns an `error` event with code `not_supported`.
 */
export interface SetModelCommand {
  type: 'set_model';
  request_id: string;
  session_id: string;
  model?: string;
}

/**
 * Phone asks the daemon to enumerate the models the SDK Query knows about.
 * Reply is a `supported_models` event keyed on `request_id`.
 * Observer-mode sessions reply with `error { code: 'not_supported' }`.
 */
export interface GetSupportedModelsCommand {
  type: 'get_supported_models';
  request_id: string;
  session_id: string;
}

/**
 * Phone asks the daemon for the SDK Query's current context-window usage.
 * Reply is a `context_usage` event keyed on `request_id`.
 * Observer-mode sessions reply with `error { code: 'not_supported' }`.
 */
export interface GetContextUsageCommand {
  type: 'get_context_usage';
  request_id: string;
  session_id: string;
}

/**
 * Phone asks the daemon to enumerate the slash commands the SDK Query knows
 * about (built-in + plugin + project-local). Reply is a `supported_commands`
 * event keyed on `request_id`.
 * Observer-mode sessions reply with `error { code: 'not_supported' }`.
 */
export interface GetSupportedCommandsCommand {
  type: 'get_supported_commands';
  request_id: string;
  session_id: string;
}

/**
 * Phone asks the daemon to enumerate the subagents the SDK Query can spawn
 * for this session. Reply is a `supported_agents` event keyed on `request_id`.
 * Observer-mode sessions reply with `error { code: 'not_supported' }`.
 */
export interface GetSupportedAgentsCommand {
  type: 'get_supported_agents';
  request_id: string;
  session_id: string;
}

/**
 * Phone asks the daemon for the SDK Query's MCP server connection status
 * for this session. Reply is an `mcp_server_status` event keyed on
 * `request_id`. Observer-mode sessions reply with `error { code: 'not_supported' }`.
 */
export interface GetMcpServerStatusCommand {
  type: 'get_mcp_server_status';
  request_id: string;
  session_id: string;
}

/**
 * Phone asks the daemon to rewind tracked file changes back to the on-disk
 * state captured at the named user message. Requires the daemon to have
 * created the SDK Query with `enableFileCheckpointing: true` (controller
 * mode only — observer-mode sessions reply with `error { code: 'not_supported' }`).
 *
 * `dry_run: true` returns the change preview (`files_changed`, `insertions`,
 * `deletions`) without touching disk OR forking the session. The phone uses
 * dry-run first, shows the user what will change, and only sends a second
 * command with `dry_run` absent/false on explicit confirmation.
 *
 * On a non-dry-run apply the daemon (a) calls SDK `rewindFiles` to restore
 * disk state, (b) calls SDK `forkSession({ upToMessageId })` to slice the
 * transcript inclusive of the target user message, (c) ends the original
 * session and resumes the fork as the new live session. The reply carries
 * the new session id in `new_session_id` and the phone is expected to
 * navigate from `session_id` to `new_session_id`.
 *
 * Reply is a `rewind_session_response` event keyed on `request_id`.
 */
export interface RewindSessionCommand {
  type: 'rewind_session';
  request_id: string;
  session_id: string;
  /** UUID of the user message in the SDK transcript to rewind back to. */
  user_message_id: string;
  /** When true, preview only — no files are modified, no fork happens. Default false. */
  dry_run?: boolean;
}

export interface ListSessionsCommand {
  type: 'list_sessions';
  request_id: string;
  offset?: number;   // default 0
  limit?: number;    // default 20
}

export interface ReadFileCommand {
  type: 'read_file';
  path: string;
  request_id: string;
}

export interface EmergencyAbortCommand {
  type: 'emergency_abort';
  phone_signature: string;
}

export interface GetHistoryCommand {
  type: 'get_history';
  session_id: string;
  /** ISO timestamp — only return messages after this time. */
  since?: string;
  /**
   * Only return messages with session_seq strictly greater than this.
   * When present, takes precedence over `since` for gap-fill on reconnect.
   * @deprecated Prefer `since_ms` under PEER_CAPABILITIES.HISTORY_CURSOR_MS.
   */
  since_seq?: number;
  /**
   * Daemon-side timestamp (epoch ms) — only return messages with
   * timestamp strictly greater than this. When present and the peer
   * announces PEER_CAPABILITIES.HISTORY_CURSOR_MS, takes precedence
   * over both `since_seq` and `since`.
   */
  since_ms?: number;
  /** Offset from the end of the message array (0 = most recent page). */
  offset?: number;
  /** Number of messages to return per page (default 30). */
  limit?: number;
}

export interface SetPreferencesCommand {
  type: 'set_preferences';
  preferences: {
    show_tool_use?: boolean;
    show_completion_metrics?: boolean;
  };
}

/**
 * Phone acks that it has received and stored every session_output up to
 * `last_seq` for `session_id`. Best-effort — daemon uses it for telemetry
 * and to avoid re-sending old buffered events when the phone reconnects.
 */
export interface SessionOutputAckCommand {
  type: 'session_output_ack';
  session_id: string;
  last_seq: number;
}

/**
 * Phone asks the daemon to confirm its local history matches the daemon's
 * source-of-truth. Daemon responds with HistoryDivergenceEvent only if
 * something is off (silence = match).
 */
export interface VerifyHistoryCommand {
  type: 'verify_history';
  session_id: string;
  /** Number of messages the phone currently has for this session. */
  count: number;
  /** Phone's in-memory message cap. When count == max_count, count divergence is expected. */
  max_count?: number;
  /**
   * session_seq of the phone's first known message (lowest seq).
   * @deprecated Prefer `head_ms` under PEER_CAPABILITIES.HISTORY_CURSOR_MS.
   */
  head_seq?: number;
  /**
   * session_seq of the phone's last known message (highest seq).
   * @deprecated Prefer `tail_ms` under PEER_CAPABILITIES.HISTORY_CURSOR_MS.
   */
  tail_seq?: number;
  /**
   * Daemon timestamp (epoch ms) of the phone's first known message.
   * Sent under PEER_CAPABILITIES.HISTORY_CURSOR_MS; daemon compares
   * against its own head timestamp for this session.
   */
  head_ms?: number;
  /**
   * Daemon timestamp (epoch ms) of the phone's last known message.
   * Sent under PEER_CAPABILITIES.HISTORY_CURSOR_MS; daemon compares
   * against its own tail timestamp for this session.
   */
  tail_ms?: number;
}

/**
 * Phone asks the daemon to backfill any missed session_output events and then
 * emit a SyncCompleteEvent terminator. The phone uses the terminator to commit
 * a side-staged batch in one transaction, avoiding session-list flicker and
 * chat-scroll churn caused by relay buffer drain on reconnect (see issue #160).
 *
 * `known_seqs` is a **hint**, not a scope. It tells the daemon the highest
 * `session_seq` the phone has already seen for each session, so the daemon can
 * skip those messages when backfilling. The daemon decides *which* sessions to
 * sync based on its own state (status != history), independent of what the
 * phone listed:
 *   - Session listed in `known_seqs` AND active on daemon → daemon backfills
 *     incrementally from `since seq=known_seqs[id]`.
 *   - Session NOT in `known_seqs` but active on daemon → daemon backfills the
 *     most recent tail window (default 30 messages). This covers brand-new
 *     sessions created while the phone was offline.
 *   - Session has `history` status on daemon → daemon skips it entirely;
 *     phone must call `get_history` if the user opens that chat.
 *
 * Why a hint and not a whitelist: the phone's idea of "which sessions matter"
 * is based on its stale local cache; the daemon's view of "what is currently
 * active" is the source of truth. Making the phone authoritative caused
 * sessions newly active during phone-offline windows to be missed on reconnect
 * (#250 round 2). The daemon is now authoritative for scope.
 *
 * Gated by PEER_CAPABILITIES.SYNC_BOUNDARY.
 */
export interface SyncRequestCommand {
  type: 'sync_request';
  request_id: string;
  /**
   * Phone's local watermark map: session_id → highest session_seq seen.
   * Empty object is valid (cold start). Daemon treats missing entries as
   * "phone has not seen this session" and backfills the tail window.
   * @deprecated Prefer `known_ms` under PEER_CAPABILITIES.HISTORY_CURSOR_MS.
   *             Both fields may be sent; daemon prefers `known_ms` when present.
   */
  known_seqs: Record<string, number>;
  /**
   * Phone's local watermark map: session_id → highest daemon timestamp
   * (epoch ms) seen. Used in place of `known_seqs` under
   * PEER_CAPABILITIES.HISTORY_CURSOR_MS. Same scope semantics as
   * `known_seqs` (hint only — daemon decides which sessions to ship).
   */
  known_ms?: Record<string, number>;
}

export type NotificationDeliveryEventType =
  | 'permission_request'
  | 'user_question'
  | 'plan_review'
  | 'session_completed'
  | 'session_error';

/**
 * Phone acknowledges that it received and processed a high-priority event
 * that can surface a user notification. This is separate from resolving the
 * underlying permission/question/plan: delivery ACK only means the phone has
 * enough information to render or intentionally suppress a duplicate.
 *
 * Gated by PEER_CAPABILITIES.NOTIFICATION_DELIVERY_ACKS.
 */
export interface NotificationDeliveryAckCommand {
  type: 'notification_delivery_ack';
  session_id: string;
  event_type: NotificationDeliveryEventType;
  request_id: string;
  delivered_at: number;
}

export type PhoneCommand =
  | NewSessionCommand
  | ResumeSessionCommand
  | SendMessageCommand
  | PermissionResponseCommand
  | QuestionResponseCommand
  | KillSessionCommand
  | InterruptSessionCommand
  | SetPermissionModeCommand
  | SetModelCommand
  | GetSupportedModelsCommand
  | GetContextUsageCommand
  | GetSupportedCommandsCommand
  | GetSupportedAgentsCommand
  | GetMcpServerStatusCommand
  | RewindSessionCommand
  | ListSessionsCommand
  | ReadFileCommand
  | EmergencyAbortCommand
  | GetHistoryCommand
  | SetPreferencesCommand
  | SessionOutputAckCommand
  | VerifyHistoryCommand
  | SyncRequestCommand
  | NotificationDeliveryAckCommand;

// ============================================================================
// PC → Phone Events
// ============================================================================

export interface SessionStartedEvent {
  type: 'session_started';
  session_id: string;
  request_id: string;
  working_directory: string;
  project_name?: string;
  agent_type?: AgentType;
  agent_display_name?: string;
  agent_version?: string;
  capabilities?: string[];
  /** See SessionInfo.is_observed. */
  is_observed?: boolean;
  /** See SessionInfo.permission_mode. */
  permission_mode?: PermissionMode;
  /** See SessionInfo.dangerously_skip_permissions. */
  dangerously_skip_permissions?: boolean;
}

export interface SessionOutputEvent {
  type: 'session_output';
  session_id: string;
  event: ClaudeEvent;
  timestamp: number;
  agent_type?: AgentType;
  /**
   * Per-session monotonically increasing sequence number assigned by the
   * daemon when the event is first emitted. Used by the phone to detect
   * gaps and request fill via get_history{since_seq}. Optional only for
   * back-compat with older daemons; current daemons always set it.
   *
   * When the daemon announces PEER_CAPABILITIES.MESSAGES_SEQ_AUTHORITATIVE
   * this number is the SOLE valid sort key for messages within a session,
   * is ALWAYS set, and is stable across daemon restarts and JSONL re-parses
   * (a given `sdk_uuid` keeps the same `session_seq` forever). Phones must
   * use it as the absolute order; `timestamp` is for display only.
   */
  session_seq?: number;
  /**
   * Stable per-row identifier mirrored from `event.sdkUuid` for ergonomic
   * top-level access on the phone (avoids reaching into the discriminated
   * `event` union to dedup). Always set when the daemon announces
   * PEER_CAPABILITIES.STABLE_SDK_UUID; otherwise omitted.
   */
  sdk_uuid?: string;
  /// Block index inside the source row's `message.content[]`. Set when
  /// `event` is a thinking or assistant_message variant from a multi-block
  /// row; omitted otherwise.
  sdk_block_index?: number;
}

export interface SessionEndedEvent {
  type: 'session_ended';
  session_id: string;
  exit_code: number;
  end_reason?: string;
  /** Stable id for session_error notification delivery ack when exit_code != 0. */
  request_id?: string;
}

export interface SessionStatusEvent {
  type: 'session_status';
  session_id: string;
  status: SessionStatus;
  action_type?: 'permission_request' | 'user_question' | 'plan_review';
  is_completion?: boolean;
  completion_request_id?: string;
  completion_body?: string;
  completion_subtitle?: string;
}

export interface PermissionRequestEvent {
  type: 'permission_request';
  session_id: string;
  agent_type?: AgentType;
  request_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  risk_level: RiskLevel;
  context: string;
  pc_signature: string; // Ed25519 signature
  seq: number;
  timestamp: number;
  ttl: number; // seconds, matches hook HTTP timeout (default 120)
  has_always_allow?: boolean; // whether the terminal shows "Always Allow" option
}

export interface PermissionDismissedEvent {
  type: 'permission_dismissed';
  request_id: string;
  tool_name: string;
}

export interface PermissionExpiredEvent {
  type: 'permission_expired';
  session_id: string;
  request_id: string;
  tool_name: string;
}

export interface SessionListEvent {
  type: 'session_list';
  request_id: string;
  sessions: SessionInfo[];
  total_count: number;
  offset: number;
  has_more: boolean;
}

export interface SessionInfo {
  session_id: string;
  agent_type?: AgentType;
  agent_display_name?: string;
  agent_version?: string;
  capabilities?: string[];
  status: SessionStatus;
  working_directory: string;
  project_name: string;
  last_activity: number;
  summary?: string;
  entrypoint?: string;
  pid?: number;
  /**
   * True when the daemon is observing a terminal-owned Claude session
   * (JSONL tail + HTTP hooks). False/undefined when the daemon owns the
   * session via SDK Query (controller mode). Phone uses this to gate
   * controller-only UI like the permission-mode picker.
   */
  is_observed?: boolean;
  /**
   * Current SDK permission mode for controller-mode sessions. Updated by
   * the daemon after a successful set_permission_mode command (or on
   * session creation). Always undefined for observed sessions.
   */
  permission_mode?: PermissionMode;
  /**
   * True when this controller-mode session was launched with
   * `allowDangerouslySkipPermissions: true`, meaning it's eligible to switch
   * into `bypassPermissions` mode at runtime. Always undefined / false for
   * observed sessions and for controller sessions that opted out.
   */
  dangerously_skip_permissions?: boolean;
  /**
   * Highest `session_seq` the daemon has ever assigned for this session
   * (i.e. the persistent allocator's `tail()`). Phones gate
   * `loadInitialMessages` on this: when the disk-cache tail equals
   * `tail_seq`, no network request is needed — the session is already in
   * sync. Only populated under PEER_CAPABILITIES.MESSAGES_PRECISE_DIVERGENCE;
   * older daemons leave it undefined and phones fall back to the legacy
   * "always request" path.
   */
  tail_seq?: number;
  /**
   * Daemon timestamp (epoch ms) of the most recent message for this
   * session. Under PEER_CAPABILITIES.HISTORY_CURSOR_MS phones use this
   * (instead of `tail_seq`) to short-circuit `loadInitialMessages` when
   * the disk-cache tail timestamp already matches.
   */
  tail_ms?: number;
}

export interface FileContentEvent {
  type: 'file_content';
  request_id: string;
  path: string;
  content: string;
  language?: string;
}

export interface ErrorEvent {
  type: 'error';
  request_id?: string;
  message: string;
  code?: string;
}

/**
 * Acknowledges a phone-originated send_message. Sent twice in the happy
 * path:
 *   - status='received' immediately when daemon parses the command
 *   - status='committed' when the message is in the session's input
 *     pipeline (controller mode: pushed to SDK input; observer mode:
 *     terminal injection confirmed in JSONL)
 * Sent once with status='failed' when injection ultimately fails.
 */
export interface MessageAckEvent {
  type: 'message_ack';
  client_message_id: string;
  session_id: string;
  status: 'received' | 'committed' | 'failed';
  /** Daemon-side message identifier when committed (currently unused — reserved). */
  server_message_id?: string;
  /** Failure reason when status='failed'. */
  error?: string;
  /** Daemon timestamp (epoch ms). */
  ts: number;
  /**
   * SDK transcript UUID assigned by Claude Code once the message lands in the
   * JSONL transcript. Sent in a follow-up `committed` ack from controller-mode
   * sessions where the daemon couldn't have known the uuid at first ack time.
   * Phone uses this to enable per-message rewind on bubbles it sent locally.
   * Omitted on the initial `received`/`committed` ack and on observed-mode
   * sessions (those echo through session_output user_message which already
   * carries sdkUuid).
   */
  sdk_uuid?: string;
}

/**
 * Daemon's response to verify_history when the phone's view diverges from
 * the on-disk session history. The phone should re-fetch via get_history.
 */
export interface HistoryDivergenceEvent {
  type: 'history_divergence';
  session_id: string;
  /** The daemon's authoritative message count. */
  expected_count: number;
  /** Daemon's tail seq (last assigned session_seq for this session). */
  expected_tail_seq?: number;
  /**
   * Daemon's tail timestamp (epoch ms of the most recent message). Sent
   * under PEER_CAPABILITIES.HISTORY_CURSOR_MS in place of (or alongside)
   * `expected_tail_seq` so the phone can compare against its disk tail
   * timestamp instead of a seq.
   */
  expected_tail_ms?: number;
  reason: 'count_mismatch' | 'tail_seq_mismatch' | 'head_seq_mismatch' | 'tail_ms_mismatch';
}

/**
 * Terminator for a SyncRequestCommand. Daemon emits this AFTER queuing every
 * session_output event for the requested sync, so the phone can commit its
 * side-staged batch in one transaction (see issue #160).
 *
 * `delivered` is the per-session terminal session_seq the daemon flushed for
 * this sync. The phone validates `delivered.last_seq` against its own staged
 * tail and triggers a `get_history` gap-fill if anything was dropped.
 *
 * Gated by PEER_CAPABILITIES.SYNC_BOUNDARY.
 */
export interface SyncCompleteEvent {
  type: 'sync_complete';
  request_id: string;
  /**
   * Per-session terminal cursors for what the daemon just flushed.
   * `last_seq` is always populated for legacy peers; `last_ms` is
   * populated under PEER_CAPABILITIES.HISTORY_CURSOR_MS and carries
   * the daemon timestamp (epoch ms) of the final flushed message.
   */
  delivered: Array<{ session_id: string; last_seq: number; last_ms?: number }>;
}

/**
 * Daemon emits this immediately on receiving a `sync_request`, BEFORE doing
 * any backfill IO. Lets the phone:
 *   - confirm the daemon actually received the request (vs. it being buffered
 *     on the relay because the daemon is offline — fail fast in that case)
 *   - replace its fixed force-flush timer with a size-aware budget based on
 *     `sessions[*].estimated_messages`
 *
 * `sessions` enumerates exactly what the daemon will emit `session_history`
 * for during this sync. Phone may use this to pre-allocate staging or surface
 * progress UI.
 *
 * Gated by PEER_CAPABILITIES.SYNC_ACK.
 */
export interface SyncAckEvent {
  type: 'sync_ack';
  request_id: string;
  sessions: Array<{ session_id: string; estimated_messages: number }>;
}

/**
 * Per-session progress event during a sync. Daemon emits this immediately
 * after queuing the `session_history` for one session, so the phone can:
 *   - advance progress UI without waiting on the trailing `sync_complete`
 *   - commit per-session if it chooses streaming behavior
 *
 * Order: `sync_ack` → (`session_history` + `session_history_done`)* →
 *        `sync_complete`. The phone should not require this event — old
 * daemons skip straight to `sync_complete` and that is still valid.
 *
 * Gated by PEER_CAPABILITIES.SYNC_ACK.
 */
export interface SessionHistoryDoneEvent {
  type: 'session_history_done';
  request_id: string;
  session_id: string;
  last_seq: number;
  /**
   * Daemon timestamp (epoch ms) of the final message just flushed for
   * this session. Sent under PEER_CAPABILITIES.HISTORY_CURSOR_MS;
   * phones use this (in place of `last_seq`) to record the per-session
   * cursor that will feed the next `sync_request.known_ms`.
   */
  last_ms?: number;
}

/**
 * Generic ack for control commands that don't carry a payload.
 * Sent in response to `set_permission_mode` and `set_model`.
 * Failures are reported via the existing `ErrorEvent` keyed on `request_id`.
 */
export interface CommandAckEvent {
  type: 'command_ack';
  request_id: string;
  session_id: string;
  command: 'set_permission_mode' | 'set_model';
}

/**
 * Pushed by daemon when a controller-mode session's permission mode changes
 * (typically right after a successful set_permission_mode command). Phone uses
 * this to update the picker selection in the chat toolbar.
 */
export interface SessionPermissionModeChangedEvent {
  type: 'session_permission_mode_changed';
  session_id: string;
  mode: PermissionMode;
}

/**
 * Mirrors the Claude Agent SDK's ModelInfo type. Daemon enumerates these via
 * `query.supportedModels()` for controller-mode sessions. Phone consumes the
 * list to populate the chat-toolbar model picker.
 */
export interface ModelInfo {
  value: string;
  display_name: string;
  description: string;
  supports_effort?: boolean;
  supported_effort_levels?: Array<'low' | 'medium' | 'high' | 'xhigh' | 'max'>;
  supports_adaptive_thinking?: boolean;
  supports_fast_mode?: boolean;
  supports_auto_mode?: boolean;
}

/**
 * Effort tier appended as a suffix to the API model id (e.g. `claude-opus-4-7-high`).
 * `none` means no suffix. Determined by the daemon's static catalog rather than the
 * SDK's `supportedModels()` (which omits older versions and effort variants entirely).
 */
export type ModelEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * One row in the daemon-curated model catalog. iOS renders three pickers (family,
 * version, effort) plus a 1M-context toggle, then composes the resulting model id
 * as `claude-{family}-{version}[-{effort}][1m]` and sends it via `set_model`.
 *
 * Why a static catalog instead of `Query.supportedModels()`: the SDK only lists
 * 4 alias entries (`default`/`opus`/`sonnet`/`haiku`) plus whichever specific
 * build the session was launched with, so older versions like Sonnet 4.5 and
 * effort tiers like `-xhigh` are unreachable through the picker. The SDK
 * itself accepts any well-formed id (verified by probing all 72 combinations
 * of family×version×effort×1m on SDK 0.2.129), so we own the catalog.
 */
export interface ModelCatalogEntry {
  family: 'sonnet' | 'opus' | 'haiku';
  /** API id fragment between family and any suffix, e.g. `4-7` for opus 4.7. */
  version: string;
  /** Human-readable name for the version, e.g. "4.7" or "4.6". */
  version_label: string;
  /** Whether the family/version supports the `[1m]` 1M-context suffix. */
  supports_one_m: boolean;
  /** Effort tiers acceptable for this version. `none` is implicit. */
  effort_levels: Array<Exclude<ModelEffort, 'none'>>;
  /** SDK reports this in `supportsFastMode`. Phone shows it as a hint only. */
  supports_fast_mode?: boolean;
}

export interface ModelCatalog {
  entries: ModelCatalogEntry[];
}

/**
 * Daemon's reply to `get_supported_models`. `request_id` echoes the command's
 * id so the phone can correlate the response.
 */
export interface SupportedModelsEvent {
  type: 'supported_models';
  request_id: string;
  session_id: string;
  models: ModelInfo[];
  /**
   * The currently selected model for this session, sourced from
   * `Query.getContextUsage().model`. May be a member of `models[].value`
   * (when the user has pinned a specific build) or a resolved full ID
   * for an alias (e.g. `claude-sonnet-4-5` when the user picked `sonnet`).
   * Phones should treat this as authoritative for showing the selection
   * checkmark, falling back to family-prefix matching when the string is
   * not a literal member of `models[].value`.
   */
  current_model?: string;
  /**
   * Daemon-curated catalog used by phones that render structured pickers
   * (family / version / effort / 1m). Optional so old phones still work
   * off the legacy `models` array. New phones should prefer this when present.
   */
  model_catalog?: ModelCatalog;
}

/**
 * Mirrors the SDK's SDKControlGetContextUsageResponse. The phone uses
 * `total_tokens`/`max_tokens`/`percentage` for the inline chat-toolbar chip
 * and the rest of the fields for the detail sheet (categories, memory files,
 * mcp tools breakdown, etc.). All fields except the four primary numbers
 * and `model` are optional so future SDK additions don't break old phones.
 */
export interface ContextUsageInfo {
  categories: Array<{ name: string; tokens: number; color: string; is_deferred?: boolean }>;
  total_tokens: number;
  max_tokens: number;
  raw_max_tokens: number;
  percentage: number;
  model: string;
  memory_files?: Array<{ path: string; type: string; tokens: number }>;
  mcp_tools?: Array<{ name: string; server_name: string; tokens: number; is_loaded?: boolean }>;
  deferred_builtin_tools?: Array<{ name: string; tokens: number; is_loaded: boolean }>;
}

/**
 * Daemon's reply to `get_context_usage`. `request_id` echoes the command's id.
 */
export interface ContextUsageEvent {
  type: 'context_usage';
  request_id: string;
  session_id: string;
  usage: ContextUsageInfo;
}

/**
 * Mirrors the SDK's SlashCommand. `argument_hint` may be empty.
 */
export interface SlashCommandInfo {
  name: string;
  description: string;
  argument_hint: string;
  aliases?: string[];
}

/**
 * Daemon's reply to `get_supported_commands`.
 */
export interface SupportedCommandsEvent {
  type: 'supported_commands';
  request_id: string;
  session_id: string;
  commands: SlashCommandInfo[];
}

/**
 * Mirrors the SDK's AgentInfo.
 */
export interface AgentInfoLite {
  name: string;
  description: string;
  model?: string;
}

/**
 * Daemon's reply to `get_supported_agents`.
 */
export interface SupportedAgentsEvent {
  type: 'supported_agents';
  request_id: string;
  session_id: string;
  agents: AgentInfoLite[];
}

/**
 * Mirrors the SDK's McpServerStatus, slimmed down to fields the phone UI
 * actually uses. Snake_case wire fields match the rest of the protocol.
 */
export type McpServerConnectionStatus = 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled';

export interface McpServerToolInfo {
  name: string;
  description?: string;
}

export interface McpServerInfo {
  name: string;
  status: McpServerConnectionStatus;
  scope?: string;
  error?: string;
  server_version?: string;
  tools?: McpServerToolInfo[];
}

/**
 * Daemon's reply to `get_mcp_server_status`.
 */
export interface McpServerStatusEvent {
  type: 'mcp_server_status';
  request_id: string;
  session_id: string;
  servers: McpServerInfo[];
}

/**
 * Daemon's reply to `rewind_session`. `dry_run` echoes the request flag so
 * the phone can route between the preview sheet and the final apply path.
 *
 * On a successful apply (`dry_run=false`, `can_rewind=true`), `new_session_id`
 * is the fork's session id and the phone must navigate the user from
 * `session_id` to `new_session_id`. The original `session_id` is ended.
 *
 * On dry-run the file change stats (`files_changed`, `insertions`,
 * `deletions`) reflect what `rewindFiles` *would* do; `new_session_id` is
 * absent because no fork happens. When `can_rewind` is false, `error`
 * carries the SDK's reason (e.g. file checkpointing not enabled, unknown
 * user message id, observed-mode session).
 */
export interface RewindSessionResponseEvent {
  type: 'rewind_session_response';
  request_id: string;
  session_id: string;
  can_rewind: boolean;
  dry_run: boolean;
  error?: string;
  files_changed?: string[];
  insertions?: number;
  deletions?: number;
  /** New (forked) session id, set only when dry_run=false and can_rewind=true. */
  new_session_id?: string;
}

export type PcEvent =
  | SessionStartedEvent
  | SessionOutputEvent
  | SessionEndedEvent
  | SessionStatusEvent
  | PermissionRequestEvent
  | PermissionDismissedEvent
  | PermissionExpiredEvent
  | SessionListEvent
  | FileContentEvent
  | ErrorEvent
  | MessageAckEvent
  | HistoryDivergenceEvent
  | SyncCompleteEvent
  | SyncAckEvent
  | SessionHistoryDoneEvent
  | CommandAckEvent
  | SessionPermissionModeChangedEvent
  | SupportedModelsEvent
  | ContextUsageEvent
  | SupportedCommandsEvent
  | SupportedAgentsEvent
  | McpServerStatusEvent
  | RewindSessionResponseEvent;

// ============================================================================
// Peer Hello (E2E, peer-to-peer)
// ============================================================================

/**
 * Sent by each peer (daemon, app) immediately after the E2E session key is
 * established. Travels inside the encrypted channel — relay never sees it.
 *
 * Both sides use the received `capabilities` array to decide whether to
 * use a feature. Unknown capability strings must be ignored (forward-compat).
 * The `product_version` is strictly informational (UI/telemetry) — never
 * gate behavior on it; gate on capabilities.
 *
 * Re-sent whenever the E2E channel is (re-)established, so stale caps from
 * an earlier session cannot leak into a new one.
 *
 * Relay-mode peers (`product: 'app'|'daemon'` over WebSocket via the relay)
 * use `PeerHelloControlFrame` in `relay-control.ts` instead — the relay
 * caches it per pair and replays on reconnect, so capability negotiation is
 * a state the relay owns rather than an event that fires on every connect.
 *
 * This E2E `PeerHello` PcEvent is the LAN-mode equivalent: when the phone
 * connects directly to the daemon over LAN there is no relay to cache
 * anything, so both peers exchange `peer_hello` inside the encrypted
 * channel right after `lan_auth_result`. Retained indefinitely for that
 * path — do not delete without first redesigning LAN-mode capability
 * negotiation.
 */
export interface PeerHello {
  type: 'peer_hello';
  product: 'daemon' | 'app';
  product_version: string;
  wire_version: number;
  capabilities: string[];
  sent_at: number;
}

// ============================================================================
// Relay Protocol (Envelope)
// ============================================================================

export interface WakeBlobPayload {
  type: 'permission_request' | 'user_question' | 'session_completed' | 'plan_review' | 'session_error';
  session_name?: string;
  body: string;
  subtitle?: string;
  sound?: string;
  category?: string;
  session_id?: string;
  request_id?: string;
}

export interface RelayEnvelope {
  pair_id: string;
  sender: 'phone' | 'pc';
  encrypted_payload: string; // base64-encoded E2E ciphertext
  nonce: number;
  timestamp: number;
  /**
   * Deprecated: do not populate. Relay-visible push metadata breaks the
   * zero-knowledge payload boundary; offline APNs pushes are generic wake
   * notifications.
   */
  push_hint?: never;
  /**
   * Boolean wake bit. When true and the recipient is offline, the relay sends
   * an APNs wake notification. The relay-visible envelope carries no
   * session/request content; the daemon sets it only for events that warrant interrupting the user
   * (permission_request, user_question, session_completed, plan_review,
   * session_error). Absent or false → relay does not push.
   */
  wake?: boolean;
  /**
   * Force an APNs wake even when the relay currently believes the phone peer is
   * online. This is only for delivery-ACK retry of high-priority events; it
   * carries no relay-visible session/request content.
   */
  force_wake?: boolean;
  /**
   * Opaque fixed-size encrypted wake summary for iOS Notification Service
   * Extension display. The relay may copy it into APNs payloads but must not
   * decrypt or interpret it.
   */
  wake_blob?: string;
}

// ============================================================================
// Pairing Protocol
// ============================================================================

export interface QrCodePayload {
  relay_url: string;
  pairing_id: string;
  pc_ephemeral_pk: string; // base64 X25519 public key
  otp: string;
  timestamp: number;
  expires: number; // 2 minutes
  mode?: ConnectionMode; // defaults to 'relay' for backward compat
  lan_host?: string; // daemon's LAN IP address
  lan_port?: number; // daemon's LAN WebSocket port
}

export interface PairingRequest {
  type: 'pairing_request';
  pairing_id: string;
  phone_ephemeral_pk: string; // base64 X25519 public key
  otp_proof: string; // HMAC(otp, shared_secret)
}

export interface PairingResponse {
  type: 'pairing_response';
  pairing_id: string;
  success: boolean;
  sas_digits?: string; // 6-digit code for visual verification
}

export interface PairingConfirm {
  type: 'pairing_confirm';
  pairing_id: string;
  confirmed: boolean;
  encrypted_identity_pk: string; // Ed25519 long-term pk, encrypted with session_key
}

// ============================================================================
// JWT Claims
// ============================================================================

export interface DeviceTokenClaims {
  pair_id: string;
  device_type: 'phone' | 'pc';
  device_id: string;
  iat: number;
  exp: number; // 90 days
}

export interface SessionTokenClaims {
  pair_id: string;
  session_nonce: string;
  iat: number;
  exp: number; // 24 hours
}

// ============================================================================
// Risk Classification
// ============================================================================

export const RISK_CLASSIFICATION: Record<string, RiskLevel> = {
  // LOW — read-only operations
  'Read': RiskLevel.LOW,
  'Glob': RiskLevel.LOW,
  'Grep': RiskLevel.LOW,
  'WebFetch': RiskLevel.LOW,
  'WebSearch': RiskLevel.LOW,
  // LOW — plan mode operations (auto-approved or handled specially)
  'EnterPlanMode': RiskLevel.LOW,
  'ExitPlanMode': RiskLevel.LOW,
  // MEDIUM — file modifications
  'Edit': RiskLevel.MEDIUM,
  'Write': RiskLevel.MEDIUM,
  'NotebookEdit': RiskLevel.MEDIUM,
  // HIGH — command execution
  'Bash': RiskLevel.HIGH,
  // CRITICAL — destructive or irreversible
  'emergency_abort': RiskLevel.CRITICAL,
};

// ============================================================================
// LAN Direct Connection — Auth Handshake
// ============================================================================

/** Sent by daemon as the first message when phone connects via LAN WebSocket. */
export interface LanAuthChallenge {
  type: 'lan_auth_challenge';
  challenge: string; // random nonce (base64)
  server_identity_pk: string; // daemon's Ed25519 public key (base64)
  // Wire version negotiation. Daemon advertises its supported range; phone
  // replies with its own in LanAuthResponse. Absent on pre-negotiation
  // daemons — treat as [1,1].
  wire_version?: number;
  min_supported_version?: number;
}

/** Phone signs the challenge with its Ed25519 key and replies. */
export interface LanAuthResponse {
  type: 'lan_auth_response';
  pair_id: string;
  challenge_signature: string; // Ed25519 signature of challenge (base64)
  client_identity_pk: string; // phone's Ed25519 public key (base64)
  // Absent on pre-negotiation phones — treat as [1,1].
  wire_version?: number;
  min_supported_version?: number;
}

/** Daemon verifies and replies with success/failure. */
export interface LanAuthResult {
  type: 'lan_auth_result';
  success: boolean;
  error?: string;
  // Daemon's authoritative pick from the intersection of the two ranges.
  // Absent on pre-negotiation daemons.
  negotiated_wire_version?: number;
}

// ============================================================================
// LAN Direct Connection — Pairing (replaces relay POST /pair/complete)
// ============================================================================

export interface LanPairRequest {
  phone_ephemeral_pk: string; // base64 X25519 public key
  phone_identity_public_key: string; // base64 Ed25519 public key
  phone_name: string;
}

export interface LanPairResponse {
  success: boolean;
  pair_id: string;
  pc_name: string;
  pc_identity_public_key: string; // base64 Ed25519 public key
  error?: string;
}
