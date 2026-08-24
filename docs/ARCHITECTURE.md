# 3iAtlas Multilingual Input — Architecture

This document describes how the authored TypeScript is organized. It is
subordinate to [`TECHNICAL_SPEC.md`](../TECHNICAL_SPEC.md) for scope and to
[`AGENTS.md`](../AGENTS.md) for structure and tooling rules.

## Layout

The repository is a single WordPress plugin, not a publishable package
workspace. `AGENTS.md` fixes the directory contract:

```
src/          authored source (PHP and TypeScript)
src/ts/       TypeScript source
assets/       compiled output only
tests/        mirrors src/ exactly
docs/         documentation only
mu-plugins/   WordPress loader entry point only
```

The bundle is built with `@wordpress/scripts` from `src/ts/index.ts` into
`assets/`. Webpack is not configured independently.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/ts/core.ts` | Input types plus pure selection, insertion, and normalization helpers |
| `src/ts/profiles.ts` | Release-one `LanguageProfile` data |
| `src/ts/adapters.ts` | Editor adapters that map host surfaces onto the insertion helper |
| `src/ts/keyman.ts` | Keyman engine lifecycle contract and its inert default adapter |
| `src/ts/input-mode.ts` | Input-mode state contract and localized mode options |

Every module uses named exports. `src/ts/index.ts` is the single build entry
point and re-exports the approved surface.

## Layering

`core.ts` is the base layer and depends on nothing. It holds no DOM access, no
network access, and no retained state, so insertion and validation behavior is
verifiable in isolation.

`adapters.ts`, `keyman.ts`, `profiles.ts`, and `input-mode.ts` each depend on
`core.ts` only. Adapters carry the host-surface differences so that inserted
characters are always applied through the same helper and never interpreted as
HTML. Cross-component state is owned by `@wordpress/data`; `input-mode.ts`
describes the shape of that state rather than storing it.

## Language profiles

Release one covers Mandinka (`mnk-Latn-GM`), Wolof (`wo-Latn-SN`), and Fula /
Fulfulde (`ff-Latn-SN`). Each profile declares a stable identifier, a BCP 47
tag, an autonym, text direction, a Unicode normalization form, and its helper
character groups. Validation rejects an incomplete profile in full; there is no
partial fallback.

## Unresolved decisions

The rendered keyboard UI, the layout JSON schema and its first supported locale
set, and the concrete Keyman engine binding are not settled. Each requires
approval in the technical specification before implementation, and each new
symbol requires an `ai_manifest.json` update.
