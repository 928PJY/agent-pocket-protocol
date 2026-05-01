# Changelog

All notable changes to `agent-pocket-protocol` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Additive constants/types → minor. Removals or incompatible shape changes → major
(and follow the capability-deprecation pattern — never delete a capability
constant while peers still announce it).

## [Unreleased]

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
