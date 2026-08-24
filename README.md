# SPARXSTAR 3iAtlas Multilingual Keyboard

SPARXSTAR 3iAtlas is a WordPress 6.9+ multilingual virtual-keyboard plugin. This
repository currently contains the governed project scaffold: the product contract,
engineering instructions, dependency manifests, static-analysis configuration, and
continuous-integration checks needed before feature implementation begins.

## Start here

1. Read [`AGENTS.md`](AGENTS.md) for mandatory coding standards.
2. Read [`INSTRUCTIONS.md`](INSTRUCTIONS.md) for the repository workflow.
3. Read [`TECHNICAL_SPEC.md`](TECHNICAL_SPEC.md) for scope, architecture, security,
   accessibility, and acceptance criteria.
4. Review [`ai_manifest.json`](ai_manifest.json) before adding or renaming symbols.

## Prerequisites

- PHP 8.2 or 8.3 and Composer 2
- Node.js 20 and pnpm 9
- WordPress 6.9 or the immediately preceding supported minor release
- Ubuntu 24.04 in CI

## Setup and validation

```bash
composer install --prefer-dist --no-interaction --no-progress
composer run lint
composer run analyse
composer run test:unit
pnpm install --frozen-lockfile
pnpm run lint:js
pnpm run build
pnpm test
```

The authored implementation belongs in `src/`; generated browser assets belong in
`assets/`. Do not commit npm or Yarn lockfiles.

## TypeScript module surface

All authored TypeScript lives under `src/ts/` and is re-exported by name from
`src/ts/index.ts`. Unit tests mirror that layout under `tests/ts/`.

| Module | Responsibility |
| --- | --- |
| `core.ts` | Input types plus pure selection, insertion, and normalization helpers |
| `profiles.ts` | Release-one `LanguageProfile` data |
| `adapters.ts` | Editor adapters that map host surfaces onto the insertion helper |
| `keyman.ts` | Keyman engine lifecycle contract and its inert default adapter |
| `input-mode.ts` | Input-mode state contract and localized mode options |

## Release-one language profiles

| Profile | BCP 47 tag | Autonym |
| --- | --- | --- |
| Mandinka | `mnk-Latn-GM` | Mandinka |
| Wolof | `wo-Latn-SN` | Wolof |
| Fula | `ff-Latn-SN` | Fulfulde |

Profiles are immutable data. A profile that declares no helper character groups, or
any group without characters, is rejected in full rather than partially loaded.

## Current status

The scaffold now carries the data model, insertion behavior, and release-one profiles
described above. The rendered keyboard UI, the layout JSON schema, and the concrete
Keyman engine binding remain unresolved decisions in the technical specification and
must be approved before implementation.

## License and security

This is proprietary software. See [`LICENSE.md`](LICENSE.md) and report security
issues according to [`SECURITY.md`](SECURITY.md).

*© 2026 Starisian Technologies. All rights reserved. Patent pending.*
