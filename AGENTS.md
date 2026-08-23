AGENTS.md --- SPARXSTAR Coding Standards
======================================

sparxstar-coding-standards-v1 | Starisian Technologies
======================================================

If it cannot fail a build, it is not a standard. It is a suggestion.
====================================================================

* * * * *

Version Policy
--------------

| Component | Version | Policy |
| --- | --- | --- |
| PHP | 8.2 minimum, 8.3 target | CI tests both. Code must pass on both. |
| WordPress | 6.9 floor (Abilities API), current stable ceiling | Rolling: N and N-1 minors supported. Update CI when WordPress releases. |
| OS | Ubuntu 24 LTS | CI runners use Ubuntu 24. Do not assume Ubuntu 22 or Debian. |
| MariaDB | Current stable | Provider-agnostic. No provider-specific extensions without abstraction layer. |
| Node.js | 20 LTS |  |
| TypeScript | 5.0+ strict | Required for all new JS. JavaScript-only files are legacy. |
| React | 18 | Ships with `@wordpress/scripts`. Do not upgrade independently. |

**Version numbers in this file are updated when the system is updated. The policy --- current stable, rolling window --- does not change.**

* * * * *

Repository Structure
--------------------

```
src/          ← all authored source code (PHP, TypeScript)
src/ts/       ← TypeScript source
assets/       ← compiled/built output only (JS bundles, CSS, images)
tests/        ← mirrors src/ structure exactly
docs/         ← documentation only
mu-plugins/   ← WordPress loader entry point only
engines/      ← JSON runtime engine schemas (where applicable)
acf-json/     ← ACF field group JSON (where applicable)

```

Compiled output goes to `assets/` --- never into `src/`.

* * * * *

Namespace Convention
--------------------

```
Starisian\Sparxstar\{RepoAbbreviation}\{Subdirectory}

```

| Repository | Root Namespace | Hook Prefix |
| --- | --- | --- |
| sparxstar-ouroboros-integrity | `Starisian\Sparxstar\Infrastructure` | `sparxstar_ouroboros_` |
| sparxstar-helios-trust | `Starisian\Sparxstar\Helios` | `sparxstar_helios_` |
| sparxstar-sirus-context | `Starisian\Sparxstar\Sirus` | `sparxstar_sirus_` |
| sparxstar-sky-eshu | `Starisian\Sparxstar\Sky` | `sparxstar_sky_` |
| sparxstar-mehns-dve-core | `Starisian\Sparxstar\Mehns` | `sparxstar_mehns_` |
| sparxstar-dheghom-dve-core | `Starisian\Sparxstar\Dheghom` | `sparxstar_dheghom_` |

PSR-4 --- directory structure under `src/` maps exactly to namespace. One class per file. File name matches class name exactly.

* * * * *

ai_manifest.json
----------------

Every repository maintains `ai_manifest.json` in the root. Check it before creating any symbol. Update it when any symbol is added, removed, or renamed. Format: `{ repository, version, namespace, symbols: [{ symbol, type, owner, path }] }`

* * * * *

Tooling
-------

| Tool | Config file | Command |
| --- | --- | --- |
| PHPStan | `phpstan.neon` | `composer run analyse` |
| PHPCS | `phpcs.xml` | `composer run lint` / `composer run lint:fix` |
| PHPUnit | `phpunit.xml` | `composer run test:unit` |
| ESLint | `.eslintrc.js` | `pnpm run lint:js` |
| Prettier | `.prettierrc.js` | `pnpm run format` |
| Jest | `jest.config.js` | `pnpm test` |
| @wordpress/scripts | `webpack.config.js` | `pnpm run build` / `pnpm run start` |

**Package manager: pnpm** --- `pnpm-lock.yaml` is the lockfile. Do not use npm or yarn. Presence of `package-lock.json` or `yarn.lock` is a CI failure.

**PHPStan levels by repo type:**

-   Infrastructure repos (Ouroboros, Helios, Sirus): level 5
-   Application/DVE repos (Sky, Mehns, Dheghom): level 4 minimum, level 5 target

* * * * *

Sirus --- Mandatory Integration Pattern
-------------------------------------

Sirus is the cross-repo authority layer. No repo may independently determine authority, context, or applicable rules.

```
Before any governed action:
  context   = Sirus::resolveContext(request)
  authority = Sirus::resolveAuthority(caller)

  if context is null OR authority is null:
    FAIL CLOSED
    return error
    do NOT execute action
    do NOT guess
    do NOT fallback

```

Sirus calls per request: 1 preferred, 2 hard cap. Response cache TTL: 30s maximum. Cross-user context reuse: forbidden. Long-lived authority caching: forbidden.

**Sirus provisional stub pattern** --- use this when Sirus package is not yet available:

```
// PROVISIONAL --- replace with Sirus package import when available
// This interface must be satisfied exactly --- it is the contract Sirus implements
interface SirusClientInterface {
    public function resolveContext(mixed $request): ?SirusContext;
    public function resolveAuthority(mixed $caller): ?AuthorityRecord;
}

```

Mark all provisional Sirus stubs with `// PROVISIONAL` so they are findable.

| FAIL | Governed action without preceding Sirus call |
| --- | --- |
| FAIL | Sirus output modified or overridden downstream |
| FAIL | Local permission check without Sirus delegation |

* * * * *

PHP --- CI Fail Conditions
------------------------

Every PHP file must begin with:

```
<?php
declare(strict_types=1);

```

`declare(strict_types=1)` before any docblock. Intentional PSR-12 deviation --- enforced in `phpcs.xml`.

| FAIL | Condition |
| --- | --- |
| FAIL | PHP file missing `declare(strict_types=1)` |
| FAIL | Function missing typed parameters or return type |
| FAIL | Raw superglobal access without sanitization |
| FAIL | Direct SQL string interpolation |
| FAIL | `SELECT *` in any query |
| FAIL | Unbounded query without `LIMIT` |
| FAIL | Governed action without Sirus call |
| FAIL | Governed action without ability check (`current_user_can()`) |
| FAIL | Governed action without consent verification |
| FAIL | `empty()` --- use `=== null`, `=== ''`, or `count() === 0` |
| FAIL | Loose comparison `==` or `!=` --- use `===` and `!==` |
| FAIL | `@phpstan-ignore` without fixing the code |
| FAIL | `var_dump()`, `print_r()`, or `error_log()` in committed code |
| FAIL | Script or style enqueued globally without conditional guard |
| FAIL | Cache invalidation or event emission before DB commit confirmed |
| FAIL | Client-supplied timestamp used for ordering or conflict resolution |
| FAIL | Direct provider-specific API call without abstraction layer |
| FAIL | `wp_die()` in platform boot code --- use `exit(1)` |

**Additional PHP rules:**

-   All classes `final` unless designed for extension
-   Constructor injection only --- no service locators, no `global`
-   No `mixed` except where a third-party contract forces it
-   No static state except constants
-   Write order on every write: DB commit → Redis invalidation → edge purge → event emission

* * * * *

JavaScript and TypeScript --- CI Fail Conditions
----------------------------------------------

**Config files:**

-   ESLint: `@wordpress/eslint-plugin` base config
-   Prettier: `@wordpress/prettier-config`
-   TypeScript: `strict: true`, `target: ES2020`, `outDir: assets/`
-   Build: `@wordpress/scripts` --- do not configure webpack independently

| FAIL | Condition |
| --- | --- |
| FAIL | `var` used anywhere |
| FAIL | Default export --- use named exports everywhere |
| FAIL | `any` in TypeScript --- use `unknown` and narrow |
| FAIL | Raw `fetch` or `XMLHttpRequest` for WordPress REST --- use `@wordpress/api-fetch` |
| FAIL | API call without timeout (`AbortSignal.timeout(5000)` minimum) |
| FAIL | Event listener without throttle or debounce |
| FAIL | Continuous interval without bounded execution |
| FAIL | JS bundle exceeds 150 KB gzipped |
| FAIL | Blob in memory exceeds 5 MB |
| FAIL | Sensor active beyond 5000ms without auto-disable |
| FAIL | Infinite retry loop --- max 3 attempts with exponential backoff |
| FAIL | UI blocked during network operation |
| FAIL | `pnpm-lock.yaml` absent when `package.json` present |
| FAIL | `package-lock.json` or `yarn.lock` present |

**WordPress JS standard:**

-   `@wordpress/data` for cross-component state --- not Redux directly
-   `@wordpress/i18n` for all user-visible strings --- no hardcoded English
-   `@wordpress/api-fetch` for all REST API calls
-   React 18 --- do not upgrade independently of WordPress core

**Execution budget --- hard caps:**

| Metric | Limit |
| --- | --- |
| Max main-thread block | 50ms |
| Max event handler rate | 10 Hz (production), 20 Hz (development) |
| Concurrent media streams | 1 |
| Blob in memory | 5 MB |
| Media buffers | 2 max |

* * * * *

CSS --- CI Fail Conditions
------------------------

**Pattern: global CSS with BEM naming. No CSS Modules.** CSS custom properties use `--spx-` prefix. All design values via custom properties only.

| FAIL | Condition |
| --- | --- |
| FAIL | CSS bundle exceeds 50 KB |
| FAIL | Physical direction properties used (see table) |
| FAIL | `outline: none` or `outline: 0` without replacement focus indicator |
| FAIL | Hardcoded colour, font size, or spacing value |
| FAIL | Blur filter or heavy shadow in production CSS |

**Logical properties --- RTL compliance:**

| Not permitted | Required instead |
| --- | --- |
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `left` / `right` (position) | `inset-inline-start` / `inset-inline-end` |
| `border-left` / `border-right` | `border-inline-start` / `border-inline-end` |

BEM: `.spx-component__element--modifier`

* * * * *

Accessibility --- WCAG 2.1 AA Required
------------------------------------

-   All interactive elements keyboard navigable
-   All form inputs have visible label or `aria-label`
-   All images have meaningful `alt` or `alt=""` if decorative
-   Colour is never the sole means of conveying information
-   Focus order matches visual order
-   Dynamic content updates announced via `aria-live` or focus management

* * * * *

Audio and Video --- CI Fail Conditions
------------------------------------

Bandwidth is a financial cost. These are billing constraints, not quality preferences. These constraints apply at the layer that processes or validates media --- not at every layer. Sky Eshu enforces them at the pipeline orchestration boundary. Starmus enforces them at capture.

| FAIL | Condition |
| --- | --- |
| FAIL | Audio `sampleRate` > 16000 |
| FAIL | Audio `channels` > 1 |
| FAIL | Audio bitrate > 32 kbps |
| FAIL | Audio format is WAV or uncompressed PCM --- Opus or AAC-LC only |
| FAIL | Video width > 640 or height > 480 |
| FAIL | Video fps > 15 |
| FAIL | Video bitrate > 800 kbps |
| FAIL | Video codec is not H.264 Baseline |
| FAIL | Recording starts automatically without explicit user action |

* * * * *

TUS Uploads --- CI Fail Conditions
--------------------------------

| FAIL | Condition |
| --- | --- |
| FAIL | Upload chunk > 512 KB |
| FAIL | Upload without chunk checksum verification |
| FAIL | Upload without UUID |
| FAIL | Full-file upload endpoint present |

Atomicity required --- upload and DB write succeed together or both roll back.

* * * * *

GraphQL --- CI Fail Conditions
----------------------------

| FAIL | Condition |
| --- | --- |
| FAIL | Query depth > 5 |
| FAIL | N+1 query pattern in resolver |
| FAIL | Governed resolver without Sirus call |
| FAIL | Unbounded list query without explicit limit |

* * * * *

Bounded Execution --- Global Hard Caps
------------------------------------

| Limit | Value |
| --- | --- |
| Max request CPU time | 2 seconds |
| Max request size | 5 MB |
| Max API response | 100 KB |
| Max concurrent ops per user | 1 mutation, 1 upload |
| Max JS bundle | 150 KB gzipped |
| Max CSS bundle | 50 KB |

* * * * *

Async and Queue Rules
---------------------

| FAIL | Condition |
| --- | --- |
| FAIL | Async job without retry policy (max 3, exponential backoff) |
| FAIL | Async job without defined timeout |
| FAIL | Synchronous media processing > 2 seconds |
| FAIL | Failed job silently discarded --- must move to dead-letter queue |

* * * * *

Distributed System Rules
------------------------

| FAIL | Condition |
| --- | --- |
| FAIL | Breaking schema change deployed without feature flag |
| FAIL | DB migration that is not rollback-safe |
| FAIL | IndexedDB usage without defined eviction policy (20 MB max, LRU) |
| FAIL | localStorage used without TTL or explicit cleanup (5 MB max) |
| FAIL | Cache invalidation before DB commit confirmed |
| FAIL | Client-supplied timestamp used for ordering |

* * * * *

Testing
-------

**PHP:** PHPUnit 11+ --- class names end `Test`, files match class names, methods `test_snake_case`, no test depends on execution order, no DB state persists between tests, mock only what you own.

**TypeScript:** Jest 29+, `ts-jest` preset, pattern `**/tests/**/*.test.ts`.

* * * * *

CI Pipeline --- Required Job Order
--------------------------------

```
1\. composer validate --strict
2. composer install --prefer-dist --no-interaction --no-progress
3. composer run lint          (PHPCS --- errors block merge, warnings pass)
4. composer run analyse       (PHPStan level 4/5 --- must pass)
5. composer run test:unit     (PHPUnit --- must pass)
6. pnpm install --frozen-lockfile   (if package.json present)
7. pnpm run lint:js           (ESLint --- errors block merge)
8. pnpm run build             (must produce output in assets/)
9. pnpm test                  (Jest --- must pass if present)

```

PHP matrix: 8.2 and 8.3 --- both must pass.

* * * * *

Git and PRs
-----------

-   No direct commits to `main`
-   PR title: `{type}({scope}): {description}` Types: `feat` `fix` `refactor` `test` `docs` `chore`
-   All CI checks must pass before merge
-   One logical change per PR

* * * * *

Final Rule
----------

Read this file before writing or reviewing any code. Apply every rule to every line. Do not apply conventions from other repositories or training data that conflict with this file. When a rule is ambiguous, apply the stricter interpretation. Check `ai_manifest.json` before creating any new symbol.
