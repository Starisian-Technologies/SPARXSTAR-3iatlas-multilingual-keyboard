# 3iAtlas Multilingual Keyboard — Technical Specification

## 1. Purpose

3iAtlas provides an accessible, embeddable virtual keyboard for entering supported
language characters in WordPress editing experiences. It supplements rather than
replaces the operating-system keyboard and must not transmit typed content.

## 2. Scope

### In scope

- A WordPress plugin loaded only on explicitly supported editor screens.
- Declarative, versioned keyboard-layout data with stable key identifiers.
- Pointer, physical-keyboard, and assistive-technology operation.
- Locale switching, dead-key composition, RTL rendering, and deterministic fallback.
- Local validation of layout schemas before a layout becomes selectable.

### Out of scope for the initial release

- Predictive text, spell checking, transliteration services, telemetry, and cloud
  synchronization.
- Collection or storage of entered text.
- Automatic language inference or independent authority decisions.
- Audio, video, uploads, GraphQL, or background queues.

## 3. Runtime architecture

1. The PHP loader registers services and conditionally enqueues the compiled asset
   only on supported WordPress screens.
2. TypeScript UI code mounts into an explicitly configured host element and uses
   named exports.
3. Layout definitions are immutable JSON data under `src/`; build output is emitted
   under `assets/`.
4. Cross-component state uses `@wordpress/data`; visible strings use
   `@wordpress/i18n`.
5. If a future governed action is introduced, it must resolve Sirus context and
   authority, verify the WordPress ability and consent, and fail closed before work.

The initial keyboard requires no network request. A future REST-backed capability
must use `@wordpress/api-fetch`, a timeout of at least five seconds, bounded retries,
nonce authentication, capability checks, consent verification, and Sirus resolution.

## 4. Layout contract

Each layout will declare a schema version, BCP 47 locale, localized display name,
text direction, and ordered rows of keys. Each key will have a stable identifier,
localized accessible label, output or bounded action, and optional modifier layers.
Unknown schema versions, duplicate identifiers, invalid directions, empty rows, and
unsupported actions must reject the entire layout without partial fallback.

Exact JSON Schema and the first supported locale set are design decisions that must
be approved before implementation. Adding them creates symbols and therefore also
requires an `ai_manifest.json` update.

## 5. Security and privacy

- Treat layouts, DOM targets, REST responses, and pasted values as untrusted input.
- Insert characters through DOM APIs; never interpret layout text as HTML.
- Do not use `innerHTML`, `eval`, dynamic code generation, raw REST `fetch`, or raw
  superglobal access.
- Keep entered text in the target control only. Do not log, persist, analyze, or send
  keystrokes.
- Package dependencies are pinned by lockfiles and audited in CI.
- Enforce the global request, response, concurrency, and execution bounds from the
  coding standards.

## 6. Accessibility and internationalization

- Conform to WCAG 2.1 AA and expose the keyboard as an ordered group of native
  buttons with localized accessible names.
- Support Tab, Shift+Tab, Enter, and Space without trapping focus. Arrow-key behavior,
  if implemented, follows the WAI-ARIA composite-widget pattern.
- Announce layout and modifier changes through a polite live region; do not announce
  every inserted character.
- Preserve logical focus order, visible focus, zoom, reduced motion, and 200% text
  resizing.
- Use logical CSS properties and layout direction metadata for RTL languages.
- Never communicate modifier or validation state by color alone.

## 7. Performance bounds

- Load no keyboard asset outside configured screens.
- Keep JavaScript below 150 KB gzipped and CSS below 50 KB.
- Keep handlers below 10 Hz where events can repeat; debounce or throttle listeners.
- Avoid continuous timers. Composition and rendering must remain below the 50 ms
  main-thread budget for a supported layout.

## 8. Testing strategy

- PHP unit tests cover conditional registration, fail-closed authorization paths,
  and asset metadata.
- TypeScript unit tests cover schema rejection, composition, modifier transitions,
  focus behavior, and RTL layouts.
- Accessibility checks cover names, roles, focus order, live announcements, contrast,
  keyboard-only use, and screen-reader smoke tests.
- Build checks enforce size budgets, forbidden lockfiles, strict TypeScript, PHPCS,
  PHPStan, and reproducible output.

## 9. Delivery milestones

1. **Foundation:** approved layouts/schema, plugin namespace, loader, build pipeline,
   and manifest entries.
2. **Core input:** rendering, insertion, modifiers, composition, and unit tests.
3. **Integration:** supported WordPress screens, conditional assets, abilities,
   consent, and Sirus boundary where applicable.
4. **Hardening:** accessibility audit, RTL validation, size budgets, threat review,
   and PHP 8.2/8.3 release matrix.

## 10. Initial-release acceptance criteria

- Approved layouts load deterministically and invalid layouts fail closed.
- Typed content never leaves the browser or persists outside the target control.
- All supported operations are usable without a pointer and have localized names.
- No asset is globally enqueued and all documented CI commands pass.
- The implementation stays within bundle and main-thread budgets.

## 11. Open decisions

- Product owner approval of the initial locales and authoritative linguistic sources.
- The exact WordPress editor surfaces and host-element integration contract.
- Product owner confirmation that `Starisian\\Sparxstar\\Atlas` and the provisional
  `sparxstar_3iatlas_` hook prefix are the final public naming contract.
- Whether layout data is shipped exclusively at build time or exposed through a
  bounded authenticated endpoint in a later release.
