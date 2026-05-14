# Changelog

All notable changes to `agent-pocket-protocol` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Additive constants/types → minor. Removals or incompatible shape changes → major
(and follow the capability-deprecation pattern — never delete a capability
constant while peers still announce it).

## [Unreleased]

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
