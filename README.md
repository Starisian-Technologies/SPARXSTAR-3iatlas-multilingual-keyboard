# 3iAtlas Multilingual Input

`@starisian/3iatlas-multilingual-input` is a standalone, client-side TypeScript
package for multilingual text input across 3iAtlas products. It runs in
browsers, including Android and iOS web apps. It is not a WordPress plugin, and
it contains no PHP, no server, and no database. Node is used only for
development, testing, building, and publishing.

Read [`TECHNICAL_SPEC.md`](TECHNICAL_SPEC.md) first — it governs this package.

## Availability and AiWA validation are separate

Two independent states, deliberately not conflated:

- **Available** — a licensed, version-pinned keyboard loads and passes input
  tests. The profile can be selected and typed with. Gate: `isKeyboardAvailable`.
- **AiWA linguistically validated** — AiWA reviewed the exact language,
  orthography, script, and regional variant. Gate: `isLinguisticallyValidated`.

A keyboard may be **available without being validated**. That is what lets
product and engineering work proceed without making false linguistic claims.

**No profile is AiWA-validated yet.** Mandinka, Wolof, and Fula are all
available; none is certified. Render `describeValidationStatus( profile )`
verbatim rather than inventing wording — CI fails the build if that string
would claim validation for an unvalidated profile. See
[`docs/PROFILE-REVIEW.md`](docs/PROFILE-REVIEW.md).

## Example application

`examples/integration` proves the package against five host surfaces: a native
input, a textarea, a contenteditable surface, a controlled React input, and the
WordPad adapter boundary.

```bash
pnpm run build
pnpm --filter @starisian/3iatlas-multilingual-input-example run dev
```

## Packages

| Package                                 | Purpose                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `…-core`                                | Framework-agnostic types, text primitives, profile schema, preferences, capability detection. No dependencies.           |
| `…-adapters`                            | Native text control, controlled React input, and WordPad editor adapters.                                                |
| `…-keyman`                              | Optional KeymanWeb boundary. Ships a null adapter only; the engine is Phase 2.                                           |
| `…-profiles`                            | Draft (unapproved) language profiles.                                                                                    |
| `…-react`                               | `MultilingualInputProvider`, `InputModeSelector`, `LanguageHelperBar`, `KeymanKeyboardHost`. React is a peer dependency. |
| `@starisian/3iatlas-multilingual-input` | Aggregate re-export of core, adapters, keyman, and profiles.                                                             |

Consumers shipping only Helper mode should depend on `core` and `adapters`
directly so that neither React nor the Keyman surface enters their bundle
(specification section 9).

The aggregate package intentionally does **not** re-export the React bindings.
Doing so would force React into every consumer, including non-React products,
which conflicts with section 9's bundle requirements. Import
`…-react` explicitly when you need it.

## Usage

```ts
import {
	insertAtSelection,
	isSupportedProfile,
	selectSupportedProfiles,
} from '@starisian/3iatlas-multilingual-input-core';
import { DRAFT_PROFILES } from '@starisian/3iatlas-multilingual-input-profiles';

// Gate any user-facing language list on approval, never on mere presence.
const offerable = selectSupportedProfiles(DRAFT_PROFILES); // [] today

const result = insertAtSelection(
	{ value: 'N ka taa', selectionStart: 2, selectionEnd: 4 },
	'ñ'
);
// result.value === 'N ñ taa'; caret collapses at the inserted boundary.
```

## Development

Requires Node 20+ and pnpm 9.

```bash
pnpm install
pnpm run validate   # lint, format check, typecheck, test, build
```

Individual steps: `pnpm run lint`, `pnpm run format`, `pnpm run typecheck`,
`pnpm test`, `pnpm run build`.

## Status against the specification

Implemented and verified: module and package boundaries (§5), the availability
and validation model (§5.5), input-mode contract and Helper default (§6.1),
helper bar with its accessibility rules (§6.3), native / textarea /
contenteditable / controlled-React / WordPad adapters (§5.3), the real
KeymanWeb adapter with self-hosting enforcement, pinning, switching, teardown
and mandatory Helper fallback (§5.4), grapheme-safe cursors and normalization
(§7), preference scoping (§6.2), non-content events and no text in storage
(§10, §12), and published bundle budgets with Helper-path isolation (§9).

Not implemented, and not claimed:

- The KeymanWeb **engine** is not vendored. It is self-hosted per deployment —
  see [`docs/KEYMAN-DEPLOYMENT.md`](docs/KEYMAN-DEPLOYMENT.md).
- No Keyman keyboard is pinned for any profile yet.
- No fonts are bundled; §8 licence and coverage work is outstanding.
- Offline asset caching (§9) is not implemented.
- **Physical device testing (§14.2) has not been done.** Browser tests run on
  desktop and mobile Chromium viewports only.
- Screen-reader and switch-control acceptance (§11) has not been done.
- **Linguistic acceptance (§14.3) is outstanding for every profile.**

## Licence and security

Proprietary. See [`LICENSE.md`](LICENSE.md) and [`SECURITY.md`](SECURITY.md).

_© 2026 Starisian Technologies. All rights reserved. Patent pending._
