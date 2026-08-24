# Architecture

This document describes how the code is organized. It is subordinate to
[`TECHNICAL_SPEC.md`](../TECHNICAL_SPEC.md).

## Platform

A standalone client-side npm package. TypeScript and JavaScript only: no PHP,
no Composer, no WordPress plugin loader, no Sirus integration, no database, and
no Node server. Node is a development, test, build, and publish tool only. The
shipped artifacts run in the browser.

## Layout

```
packages/core/         framework-agnostic core (no dependencies)
packages/adapters/     editor adapters
packages/keyman/       optional KeymanWeb boundary
packages/profiles/     draft language profiles
packages/react/        React bindings (React is a peer dependency)
packages/multilingual-input/  aggregate package
tests/                 workspace test suite
docs/                  documentation
```

Each package builds to its own `dist/` with ESM, CJS, and type declarations, and
is independently versionable per specification section 5.

## Dependency direction

`core` depends on nothing. Every other package depends on `core` and never on a
sibling, except `react`, which depends on `keyman` for the keyboard host's
types, and the aggregate, which depends on the leaves.

This keeps section 9's bundle requirements achievable: a consumer shipping only
Helper mode pulls in `core` and `adapters` and never loads the Keyman engine or
React.

## Where the rules live in code

| Specification rule                                  | Enforced by                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| §4 no support claim without review                  | `isSupportedProfile`, `selectSupportedProfiles`                                   |
| §5.5 profile field set                              | The `LanguageProfile` type                                                        |
| §5.5 approval evidence                              | `validateLanguageProfile` rejects `approved` without reviewer, date, and fixtures |
| §5.3 no DOM mutation where a transaction API exists | `WordPadEditorAdapter` delegates to the host API                                  |
| §5.4 fallback on Keyman failure                     | `checkKeymanEligibility`, `KeymanKeyboardHost`'s failure path                     |
| §6.1 helper is the default                          | `DEFAULT_INPUT_MODE`                                                              |
| §6.3 44px touch targets, language context           | `LanguageHelperBar`                                                               |
| §7 grapheme-safe cursors                            | `toGraphemes`, `previousGraphemeBoundary`, `nextGraphemeBoundary`                 |
| §10 no typed text in storage or events              | `buildPreferenceKey`, `MultilingualInputEvent`                                    |

## Known deviation

The aggregate package does not re-export the React bindings, though section 5
lists React among the modules. Re-exporting them would make React a hard
dependency of the aggregate and pull it into non-React consumers, contradicting
section 9. Consumers import `…-react` explicitly instead.
