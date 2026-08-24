# 3iAtlas Multilingual Input

`@starisian/3iatlas-multilingual-input` is a standalone, client-side TypeScript
package for multilingual text input across 3iAtlas products. It runs in
browsers, including Android and iOS web apps. It is not a WordPress plugin, and
it contains no PHP, no server, and no database. Node is used only for
development, testing, building, and publishing.

Read [`TECHNICAL_SPEC.md`](TECHNICAL_SPEC.md) first — it governs this package.

## No language is currently supported

Every shipped language profile is **provisional and unapproved**. No reviewer
has completed linguistic acceptance, so `isSupportedProfile` returns `false` for
all of them and `selectSupportedProfiles` returns an empty array.

Do not present any language in this package as supported.
[`docs/PROFILE-REVIEW.md`](docs/PROFILE-REVIEW.md) records what each profile is
missing, including a substantive concern about the Mandinka inventory.

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

Implemented: the module and package boundaries (§5), the profile schema and its
approval governance (§5.5), input-mode contract and defaults (§6.1), helper-bar
component with its accessibility rules (§6.3), editor adapters (§5.3), the
Keyman boundary and its mandatory fallback (§5.4), grapheme-safe cursor movement
and normalization (§7), preference scoping (§6.2), and non-content events (§12).

Not yet implemented, and not claimed: the KeymanWeb engine itself (Phase 2),
bundled fonts and their licence review (§8), offline asset caching and published
size budgets (§9), the physical device matrix (§14.2), IME composition and
undo/redo verification against a real host editor, and linguistic acceptance for
every profile (§14.3).

## Licence and security

Proprietary. See [`LICENSE.md`](LICENSE.md) and [`SECURITY.md`](SECURITY.md).

_© 2026 Starisian Technologies. All rights reserved. Patent pending._
