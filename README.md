# agent-pocket-protocol

Wire protocol, peer capabilities, and shared constants for the [agent-pocket](https://github.com/928PJY/agent-pocket) ecosystem. Consumed by:

- The relay server
- The [agent-pocket](https://github.com/928PJY/agent-pocket-daemon) Mac daemon
- iOS and other future clients (via type generation)

## Why a separate package

Both the relay and the daemon must agree on the wire format byte-for-byte. Keeping the protocol in its own versioned npm package means:

- A protocol change is a single source of truth, not two copy-pasted directories.
- Each consumer pins a semver range, so deploys can roll forward independently.
- Version skew between relay and daemon is visible in lockfiles, not silent.

## Workflow for protocol changes

1. Edit `protocol.ts` / `capabilities.ts` / `constants.ts` / `features.ts` here.
2. Run `npm test` locally. The contract tests verify capability/feature lists are well-formed; the wake-blob fixture tests verify the cross-language encrypted-payload format hasn't drifted.
3. Bump `version` in `package.json`. Additive changes → minor. Removals/incompatible shapes → major (and follow the capability-deprecation pattern, never delete a capability constant while peers still announce it).
4. Tag `vX.Y.Z` and push — CI runs the test suite, then publishes to npm. A failing test blocks the publish.
5. In each consumer (`agent-pocket` monorepo, `agent-pocket-daemon` repo), bump the `agent-pocket-protocol` dependency, then implement the new behavior.

## Tests

```bash
npm install
npm test
```

Tests live alongside the source in `test/`, with synthetic fixtures in `fixtures/`. They are excluded from the published tarball — only the compiled `dist/` ships to npm.

## Install

```bash
npm install agent-pocket-protocol
```

```ts
import { PEER_CAPABILITIES, WIRE_VERSION_CURRENT } from 'agent-pocket-protocol';
```

## License

MIT.
