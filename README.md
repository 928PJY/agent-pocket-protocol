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
2. Bump `version` in `package.json`. Additive changes → minor. Removals/incompatible shapes → major (and follow the capability-deprecation pattern, never delete a capability constant while peers still announce it).
3. Tag `vX.Y.Z` and push — CI publishes to npm.
4. In each consumer (`agent-pocket` monorepo, `agent-pocket-daemon` repo), bump the `agent-pocket-protocol` dependency, then implement the new behavior.

## Install

```bash
npm install agent-pocket-protocol
```

```ts
import { PEER_CAPABILITIES, WIRE_VERSION_CURRENT } from 'agent-pocket-protocol';
```

## License

MIT.
