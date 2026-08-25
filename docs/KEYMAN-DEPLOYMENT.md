# Deploying the KeymanWeb engine

The KeymanWeb engine is **not bundled** with this package.

Two reasons, both deliberate:

1. **Licensing.** KeymanWeb and each keyboard package carry their own licences.
   Specification section 16 gate 6 requires that licensing be recorded before
   those assets ship. Vendoring the engine into this repository would ship them
   before that gate is met.
2. **Self-hosting.** Section 10 prohibits loading the engine from a third-party
   CDN in production. `KeymanWebAdapter.initialize` enforces this: it refuses
   any `baseUrl` that is not same-origin or relative, and does so before
   fetching anything.

## What ships today

| Component                         | State                                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `KeymanWebAdapter`                | Implemented. Drives the real KeymanWeb API: `init`, `addKeyboards`, `setActiveKeyboard`, `attachToControl`, `detachFromControl`, `shutdown`. |
| `createScriptTagEngineLoader`     | Implemented. Injects a self-hosted engine `<script>` and resolves `window.keyman`.                                                           |
| `NullKeymanAdapter`               | Implemented. The fallback when no engine is present.                                                                                         |
| KeymanWeb engine binary           | **Not included.** Self-host it.                                                                                                              |
| A pinned Mandinka Keyman keyboard | **Not selected yet.** See below.                                                                                                             |

## Deployment steps

1. Download a KeymanWeb build from <https://keyman.com/developer/keymanweb/>
   and record its exact version.
2. Serve it from your own origin, e.g. `/assets/keyman/keymanweb.js`.
3. Record the engine licence and the licence of every keyboard package in the
   profile's `availability.metadata`.
4. Pin the keyboard in the profile:

```ts
availability: {
  status: 'available',
  keymanKeyboardId: 'sil_pan_africa_positional',
  pinnedVersion: '1.2.0',              // exact, never a range
  metadata: { source: '…', licence: '…' },
  verifiedBy: 'Browser suite on <date>, engine <version>.',
}
```

5. Wire the adapter:

```ts
const adapter = new KeymanWebAdapter({
	target: editorElement,
	loadEngine: createScriptTagEngineLoader(),
});

const ready = await adapter.initialize({
	baseUrl: '/assets/keyman', // must be same-origin
	pinnedEngineVersion: '17.0.0',
});

if (!ready) {
	// Mandatory: fall back to Helper mode. Never block typing.
}
```

`checkKeymanEligibility` refuses a profile whose keyboard is unavailable,
unpinned, or missing a licence, before any asset is fetched.

## Choosing the Mandinka keyboard

Section 17 leaves open whether SIL Pan Africa Positional covers the Gambian
Mandinka inventory or whether a language-specific layout is required. That
decision needs the reviewed inventory first, so no keyboard is pinned for
Mandinka yet and `keymanKeyboardId` is `null`. Helper mode is fully functional
in the meantime, which is why Mandinka is marked available.

## Failure behavior

Every failure resolves to a typed reason and falls back to Helper mode:

| Reason                       | Cause                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `keyboard-unavailable`       | Profile is not marked available.                                             |
| `no-approved-keyboard`       | No keyboard id or no pinned version.                                         |
| `licence-not-recorded`       | Availability metadata missing.                                               |
| `engine-unavailable`         | Engine failed to load, timed out, or the base URL was not self-hosted.       |
| `asset-load-failed`          | Engine script or keyboard asset fetch failed.                                |
| `keyboard-activation-failed` | Engine loaded but activation threw; the adapter tears down to a clean state. |

Engine loading is bounded by a timeout (8s default) so a hanging asset never
blocks typing.
