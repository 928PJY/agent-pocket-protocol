# Changelog

All notable changes to `agent-pocket-protocol` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Additive constants/types → minor. Removals or incompatible shape changes → major
(and follow the capability-deprecation pattern — never delete a capability
constant while peers still announce it).

## [Unreleased]

## [0.8.3] - 2026-05-22

### Added
- `PEER_CAPABILITIES.MESSAGES_COMPLETION_BARRIER` (`messages.completion_barrier`)。daemon 在 `wake_blob` 上填 `completion_seq` / `completion_ms` —— 通知所指那一轮最后一条消息的权威游标。phone 用它在缓存 tail 越过 barrier 的瞬间就关掉通知 echo card 和 perceived-latency trace，不再靠 `sync_complete + 500ms` 兜底（当 wake 指向 phone 已经在磁盘上的行时那条 fallback 会误触）。
- `PEER_CAPABILITIES.MESSAGES_SYNC_PRIORITY_SESSION` (`messages.sync_priority_session`)。phone 可在 `sync_request` 上带 `priority_session_id`；宣告此 cap 的 daemon 必须把该 session 的 `session_history` + `session_history_done` 在所有其他 session 之前发出来。配合既有 `messages.sync_ack` 的 `session_history_done` 终止符，phone 可以只把被聚焦 session 的 staged frames 立刻 commit，不必等关闭整个多 session sync 的 trailing `sync_complete`。
- `SyncRequestCommand.priority_session_id?: string` —— 上面 cap 对应的请求字段。

### Why
agent-pocket#271 Iter 4 + Iter 5：当用户从通知进入 app 时，被点中的 session 经常要等整个多 session backfill 走完才能完成首屏；实测 `sync_request → sync_complete` 窗口在多 session 活跃时能到 ~5s。两条 cap 一起把"被聚焦 session 何时算完成"和"perceived-latency trace 何时关闭"都收紧到 barrier 精确点。两者都是 additive —— 老 phone 忽略字段，老 daemon 永不下发。

Refs: agent-pocket#271

## [0.8.2] - 2026-05-19

### Added
- `PEER_CAPABILITIES.CODEX_TAG_EXTRACTION` (`codex.tag_extraction`)。daemon 把 Codex transcript 里的 XML 风格元标签从消息正文剥离，改成结构化 ClaudeEvent 下发；phone 据此给每类标签做专属 UI（状态条 / 模式 badge / 折叠提示 / 引用卡片），不再把原始 `<tag>` 漏到聊天气泡。覆盖 5 类标签 → 5 个新事件：
  - `CodexEnvironmentContextEvent` —— `<environment_context>` 解析出的 `cwd / shell / current_date / timezone`。
  - `CodexCollaborationModeEvent` —— `<collaboration_mode>` 解析出的 `mode + body`。
  - `CodexSkillsListingEvent` —— `<skills_instructions>` 解析出的 skill 列表（`CodexSkillInfo[]`）。
  - `CodexSystemReminderEvent` —— `<system-reminder>` 解析出的 `text`（保留 `severity?` 字段供后续扩展）。
  - `CodexMemCitationEvent` —— `<oai-mem-citation>` 解析出的 `entries[]`（含 `path / line_start / line_end / note?`）+ `rollout_ids[]`。
- 5 个对应 fixture（`codex-environment-context.json` 等），均取自真实 Codex session `019e2f7a-cdcf-7c00-a1ae-332de2118efb`。
- 5 个 sub-event 全部加入 `ClaudeEvent` 联合类型，沿用既有 `SessionOutputEvent.event` 通路下发。

### Why
Codex CLI 在 transcript 中持续注入这几类元标签（环境上下文每 turn 一次、协作模式切换声明、运行时温和提示、记忆引用尾注等）。当前 APP 把它们当普通文本一并渲染，与 assistant 正文混在一起、信息层级丢失。把解析下沉到 daemon、用 capability gate 起来后：
- 老 phone（未宣告 cap）仍收到原始 inline 标签，行为不变；
- 新 phone 收到干净正文 + 结构化事件，可以按标签类别走专属 UI（参考 Claude Code 那边 `local_command_invoke` / `local_command_output` 的先例）。

Refs: agent-pocket#267

## [0.8.1] - 2026-05-17

### Added
- `PEER_CAPABILITIES.MESSAGES_TURN_METRICS` (`messages.turn_metrics`)。daemon 把每轮的 token / tool_use / duration 直接挂在该轮最后一条 assistant message 上：
  - `AssistantMessageEvent.turnMetrics?: TurnMetrics` — 仅在该行 JSONL 的 `stop_reason === 'end_turn'` 时设置；中间行（`tool_use` 等）保持 `undefined`。
  - 新类型 `TurnMetrics { totalTokens, toolUseCount, durationSec }`，形状对齐 daemon 的 `readLastTurnSummary`。
- iOS 在带此 cap 的 daemon 下，将 metrics 渲染为该消息气泡下方的独立行（系统消息样式）。
- 当 phone 宣告此 cap 时，daemon 停发旧的 `output_type: 'completion_metrics'` session_output；老 phone 仍按旧路径展示。
- 完成通知（push）两条路径下都不再包含 metric 文本 —— metrics 只在聊天里以独立行呈现。

### Why
旧路径走 Stop hook + 500ms `setTimeout`，**只有 observer mode 触发**（controller mode 走 SDK，没有 hook 回调），controller 会话从来没有 metrics。end_turn 信号在 `session-observer` 里两种模式都识别，从这里挂 metrics 可以统一覆盖，并消除排序 hack。

## [0.8.0] - 2026-05-16

### Added
- `PEER_CAPABILITIES.HISTORY_CURSOR_MS` (`history.cursor_ms`)。当 peer 宣告此 cap 时，history pagination 用 daemon 时间戳（epoch ms）做 cursor，取代 `session_seq`：
  - `GetHistoryCommand.since_ms?: number` — 优先级高于 `since_seq` / `since`。
  - `SyncRequestCommand.known_ms?: Record<string, number>` — 与 `known_seqs` 并存；daemon 在 cap 下用 `known_ms`。
  - `VerifyHistoryCommand.tail_ms?` / `head_ms?` — 同语义，单位 ms。
  - `SessionInfo.tail_ms?` — daemon tail timestamp，用于 phone 端 short-circuit `loadInitialMessages`。
  - `SyncCompleteEvent.delivered[].last_ms?` / `SessionHistoryDoneEvent.last_ms?` — flush 末尾 timestamp。
  - `HistoryDivergenceEvent.expected_tail_ms?` + `reason: 'tail_ms_mismatch'`。
- 老字段（`since_seq` / `tail_seq` / `known_seqs` / `head_seq` / `last_seq`）保留并标 `@deprecated`，便于过渡期 daemon/iOS 双向兼容。

### Why
Phone 端 sort + dedup 之前依赖 `session_seq` + `sdk_uuid`，但 daemon 在 tool_use 行上并不总是填 `sdk_uuid`（实测占比可达 46%）。fingerprint 退化到 `tooluse|local|<id>` 与 live `sdk|<uuid>` 永不匹配，导致同一逻辑 row 重复显示。改用 daemon 时间戳做 cursor 后，phone 完全信任 daemon 在 `session_history` 里的发送顺序，不再本地重排。

Refs: agent-pocket#258

## [0.6.4-hotfix] - 2026-05-15

### Removed
- `PERMISSION_TTL_SECONDS` 常量。死代码——daemon 从未 import 它，自己用 `CONTROLLER_PERMISSION_TTL_SECONDS = 0`。删除以避免误导。

### Changed
- `capabilities.ts` 给隐式依赖的 cap 加 `@requires` JSDoc 标注（`MESSAGES_PRECISE_DIVERGENCE`, `SYNC_ACK` 等），不影响运行时行为。

### Added
- 11 个先前缺失 fixture 的 message type 补 shape contract test：EmergencyAbortCommand, KillSessionCommand, QuestionResponseCommand, PermissionExpiredEvent, PermissionDismissedEvent, FileContentEvent, ErrorEvent, SessionOutputAckCommand, GetHistoryCommand, SetPreferencesCommand, InterruptSessionCommand。

Refs: #21 (Protocol v1.0 立法计划 hotfix 批次)

## [0.6.3] - 2026-05-15

### Added
- `PEER_CAPABILITIES.MESSAGES_SEQ_AUTHORITATIVE` (`messages.seq_authoritative`), announced in `CURRENT_PEER_CAPABILITIES`. Promotes `session_seq` to the SOLE valid sort key for messages within a session and pins down stronger guarantees:
  - Every history message in `session_history.messages[]` carries a top-level `session_seq` field (the legacy `seq` field stays set for back-compat with old phones).
  - `session_seq` values are stable across daemon restarts and JSONL re-parses — a given `sdk_uuid` keeps the same `session_seq` forever (daemon persists an `sdk_uuid → session_seq` seqmap per session).
  - History `session_seq` and live `SessionOutputEvent.session_seq` share the same allocator.
  - During a sync window, `sync_complete.delivered[].last_seq` is the per-session terminal seq backfilled by this sync; phones can fold real-time `session_output` (with seq > `last_seq`) in by seq.
  - `timestamp` is for display only — phones must not use it as a sort key when this cap is in effect.
- `SessionOutputEvent.session_seq` documentation upgraded to reflect the cross-restart-stable contract under the new cap.
- `PEER_CAPABILITIES.MESSAGES_PRECISE_DIVERGENCE` (`messages.precise_divergence`), announced in `CURRENT_PEER_CAPABILITIES`. Pins down two related guarantees:
  - `SessionInfo.tail_seq` is set on every `session_list` item, carrying the daemon's allocator high-water mark for that session. Phones can compare it to their on-disk tail and skip the network entirely when they're already in sync — no more "load session → re-fetch 30 tail messages we already have" round trip.
  - `verify_history.count` and `verify_history.tail_seq` from the phone reflect the phone's **on-disk** state, not its in-memory window. The daemon's existing `count_mismatch` / `tail_seq_mismatch` checks are unchanged, but the inputs are now the right thing — long sessions where the phone trims in-memory to N stop firing spurious divergences.
  - `history_divergence` followups go out as `get_history { since_seq = disk_tail }`, so the daemon ships only the missing increment instead of re-shipping its 30-message default tail window. The legacy "blind full refetch" path could never close a gap larger than 30; this one converges in one round trip.
- `SessionInfo.tail_seq` field added to `protocol.ts` (optional; populated only by daemons that announce the new cap).

## [0.6.2] - 2026-05-14

### Added
- `PEER_CAPABILITIES.SYNC_ACK` (`messages.sync_ack`), announced in `CURRENT_PEER_CAPABILITIES`. Daemon emits `sync_ack` immediately on receiving a `sync_request` (before any backfill IO) carrying per-session `estimated_messages`, and `session_history_done` per session as each finishes streaming. Lets the phone shrink its fixed sync_complete watchdog and fail fast (no_ack) when the request is buffered behind an offline daemon. See agent-pocket #250.

### Changed (breaking)
- `SyncRequestCommand.cursors: Array<{ session_id, last_seq }>` replaced by `SyncRequestCommand.known_seqs: Record<string, number>` (session_id → highest seen session_seq). Semantics also changed: `known_seqs` is a **hint** the daemon uses to skip already-seen messages, not a whitelist scoping which sessions to backfill. The daemon now decides scope based on its own session state (status != history); sessions the phone has never seen still get backfilled (tail window) when they're active on the daemon side. Together this closes the agent-pocket #250 round-2 gap where phones using a stale local `lastActivity` ranking missed sessions newly active during phone-offline windows.
- `SyncRequestCommand.mode` field removed. Scope is now daemon-authoritative; phones no longer signal `'recent' | 'all'`.

### Migration notes
- Daemons: read `command.known_seqs` (object), look up `known_seqs[sessionId]` to decide `since seq=N`; for sessions absent from the map but active locally, send a tail window (`limit=30` by default) so brand-new sessions still reach the phone.
- Phones: stop building a `cursors` array; emit `{ ...lastSeenSeq }` directly as `known_seqs`. Stop sending `mode`. Bump `agent-pocket-protocol` to `^0.6.2`.
- Note: this release breaks the `sync_request` shape but stays in 0.6.x because no consumer has reached production on the prior shape. After this release, all wire-protocol changes follow the usual additive-minor / breaking-major rules.

## [0.6.1] - 2026-05-13

### Added
- `LocalCommandInvokeEvent`, `LocalCommandOutputEvent`, `CompactBoundaryEvent`, `CompactSummaryEvent` ClaudeEvent variants. Daemon parses `<command-name>` / `<local-command-stdout>` / `<local-command-stderr>` / `compact_boundary` / `isCompactSummary` JSONL entries into these structured events so the phone can render terminal-side `/cost`, `/recap`, `/compact`, etc. instead of dropping them.
- `PEER_CAPABILITIES.LOCAL_COMMAND` (`local.command`), announced in `CURRENT_PEER_CAPABILITIES`. Daemon must continue to drop the underlying JSONL entries when the peer lacks this cap so old iOS builds don't receive payloads they can't render.
- `LocalCommandOutputEvent.parent_invoke_sdk_uuid` — SDK `parentUuid` of the matching `<command-name>` row. Lets the phone pair invoke + output deterministically even under non-monotonic ordering (history backfill, multiple interleaved outputs). Falls back to arrival-order pairing when absent.

## [0.6.0] - 2026-05-13

### Added
- `relay-control.ts` module exporting `RELAY_CONTROL_TYPE`, `RelayControlAction` union, `RelayControlFrame` base interface, `PeerHelloControlFrame`, and `isPeerHelloControlFrame` type guard. Promotes `peer_hello` from an E2E `PcEvent` to a relay-visible control frame so the relay can cache the most recent advertisement per pair and replay it to whichever peer comes online next. Eliminates the daemon-restart race where the phone never re-emits hello and the daemon's capability set stays empty.

### Deprecated
- `PeerHello` interface in `protocol.ts`. Retained for one release so consumers can drop their parsing/sending paths in lockstep; removal scheduled for 0.7.0.

## [0.3.0] - 2026-05-01

### Added
- `COMMAND_TYPES.NOTIFICATION_DELIVERY_ACK` and `NotificationDeliveryAckCommand` so phones can acknowledge receipt of high-priority notification-backed events by stable `event_type`, `session_id`, and `request_id`.
- `PEER_CAPABILITIES.NOTIFICATION_DELIVERY_ACKS`, announced in `CURRENT_PEER_CAPABILITIES`, to gate delivery-ack behavior during rollout.
- `SessionEndedEvent.request_id` so completion and error notifications can use the same delivery identity as pending-action notifications.
- `RelayEnvelope.force_wake`, a relay-visible retry flag that lets ACK-missing wake retries send APNs even when the relay still believes the phone peer is online. The flag carries no session, request, or message content.


## [0.2.1] - 2026-05-01

### Changed
- `CURRENT_PEER_CAPABILITIES` now includes `SYNC_BOUNDARY`. The daemon's
  `sync_request` handler is merged on `main` (agent-pocket-daemon PR #25),
  so this release flips the announcement on. Phones that gate on
  `peerCapabilities.has(SYNC_BOUNDARY)` will see it from any daemon
  built against `agent-pocket-protocol@^0.2.1`.

## [0.2.0] - 2026-05-01

### Added
- `PEER_CAPABILITIES.SYNC_BOUNDARY = 'messages.sync_boundary'` — gates the
  explicit `sync_request` / `sync_complete` handshake used by the phone to
  commit reconnect backfills in one transaction (see agent-pocket issue #160).
- `SyncRequestCommand` (phone → daemon) and `SyncCompleteEvent` (daemon →
  phone) message types, wired into `PhoneCommand` and `PcEvent` unions.
- Fixtures + JSON-shape tests for both new messages.

### Notes
- `CURRENT_PEER_CAPABILITIES` deliberately does **not** include
  `SYNC_BOUNDARY` yet. The constant is published so consumers can compile
  against the type union; the daemon will announce the capability in a
  follow-up release once the `sync_request` handler ships (Phase 2 of #160).

## [0.1.1] - 2026-05-01

### Added
- `HOOK_HOLD_TIMEOUT_MS` (595_000) and `HOOK_HOLD_TIMEOUT_SECONDS` constants —
  the daemon's hook-hold window, set just under Claude Code's 10-minute hook
  timeout. Present in the pre-extraction `shared/` source but missed when 0.1.0
  was carved out.

## [0.1.0] - 2026-04-30

### Added
- Initial extraction from the `agent-pocket` monorepo's `shared/` workspace into
  a standalone, versioned npm package.
- Wire protocol message types (`protocol.ts`).
- Peer capability constants and `CURRENT_PEER_CAPABILITIES` (`capabilities.ts`).
- Shared timing/port/limit constants and `WIRE_VERSION_MIN` /
  `WIRE_VERSION_CURRENT` (`constants.ts`).
- Relay feature flags (`features.ts`).
- Contract tests and cross-language wake-blob fixture tests, gated on publish.
