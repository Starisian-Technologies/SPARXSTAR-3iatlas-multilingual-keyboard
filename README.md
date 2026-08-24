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

## Current status

The product implementation has intentionally not been invented in this setup change.
Feature work must follow the staged milestones and unresolved decisions in the
technical specification.

## License and security

This is proprietary software. See [`LICENSE.md`](LICENSE.md) and report security
issues according to [`SECURITY.md`](SECURITY.md).

*© 2026 Starisian Technologies. All rights reserved. Patent pending.*
