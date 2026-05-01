# Changelog

All notable changes to `agent-pocket-protocol` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Additive constants/types → minor. Removals or incompatible shape changes → major
(and follow the capability-deprecation pattern — never delete a capability
constant while peers still announce it).

## [Unreleased]

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
