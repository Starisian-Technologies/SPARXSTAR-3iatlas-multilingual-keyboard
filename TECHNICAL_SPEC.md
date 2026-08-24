# 3iAtlas Multilingual Input

Technical and Product Specification v0.1

Status: Proposed
Proposed repository: `sparxstar-3iatlas-multilingual-input`
Package name: `@starisian/3iatlas-multilingual-input`
Product owner: Starisian Technologies / AI West Africa
Initial consumers: WordPad, Dictionary, Dictionary Games, RLC classroom UI
Initial language priority: Mandinka, Wolof, Fula/Fulfulde, English, French

## 1. Decision

Create a standalone repository and versioned client-side package for multilingual text input across 3iAtlas products.

This is not a new server, identity service, dictionary, transliteration service, or general-purpose text editor. It is a shared input capability that products embed in their existing text fields and editors.

The package shall provide three user-selectable modes:

1. Standard keyboard — use the device keyboard without an added interface.
2. Standard + helper bar — preserve the device keyboard and add only the characters required by the selected language. This is the recommended default.
3. Keyman full keyboard — opt into a complete KeymanWeb on-screen keyboard for the selected language or approved Pan-African layout.

No user shall be forced away from a familiar QWERTY, AZERTY, or native system keyboard.

## 2. Why this belongs in a standalone repository

WordPad exposed the need first, but the need is platform-wide. Copying keyboard logic into individual products would create divergent character sets, normalization rules, accessibility behavior, and Keyman versions.

The standalone repository shall be the canonical owner of:

- input-mode behavior;
- governed language profiles and character inventories;
- KeymanWeb loading and lifecycle management;
- helper-bar rendering and insertion commands;
- Unicode normalization and validation;
- editor and form-control adapters;
- offline keyboard and font assets;
- accessibility and mobile-input requirements;
- conformance tests for consuming products.

Consumer products shall retain ownership of:

- their editor, form, game, or classroom workflow;
- language selection at the product level;
- document storage, encryption, synchronization, and authorization;
- spellchecking, definitions, translation, grading, scoring, and content moderation;
- product-specific layout and visual styling outside the package contract.

## 3. Goals

- Make correct African-language characters available on Android, iOS/iPadOS, desktop, and mobile web.
- Work with native keyboards such as Gboard rather than attempting to replace them by default.
- Provide a consistent fallback when a device keyboard lacks required characters.
- Support sustained writing through an optional complete Keyman keyboard.
- Use one governed orthographic profile across WordPad, Dictionary, Games, and classroom products.
- Operate offline after the product and selected language assets have been installed or cached.
- Preserve cursor position, selection, undo/redo history, editor state, and encrypted-document boundaries.
- Allow additional languages without changing consumer application code.

## 4. Non-goals

Release 1 shall not:

- build a new operating-system keyboard application;
- fork or reimplement Keyman;
- promise predictive text, autocorrect, speech-to-text, or transliteration;
- infer a language from user writing;
- transmit typed content to Keyman Cloud or any analytics service;
- claim support for a language merely because its characters render;
- replace linguistic review with a generic Pan-African character inventory;
- couple input authorization to Identity Node or RLC roles.

## 5. Architecture

The repository should publish independently versioned modules rather than one indivisible UI bundle.

### 5.1 Core module

Framework-agnostic TypeScript that owns:

- language-profile schemas;
- input-mode state;
- Unicode insertion and normalization utilities;
- capability detection;
- preference serialization;
- adapter interfaces;
- validation and conformance fixtures.

The core module must not depend on React, a specific editor, WordPress, RLC, or Identity Node.

### 5.2 React bindings

React components and hooks for:

- `InputModeSelector`;
- `LanguageHelperBar`;
- `KeymanKeyboardHost`;
- `MultilingualInputProvider`;
- product-facing state and lifecycle hooks.

### 5.3 Editor adapters

Adapters translate a character or keyboard action into the host editor's native transaction model.

Release 1 must include:

- native `input` and `textarea` adapter;
- WordPad editor adapter;
- controlled React input adapter.

Future adapters may cover additional rich-text editors. Direct DOM value mutation is prohibited when a host editor exposes a transaction API.

Each adapter must preserve:

- active selection and caret position;
- focus;
- undo and redo;
- input/composition events;
- editor history boundaries;
- replacement of selected text;
- grapheme-safe cursor movement.

### 5.4 Keyman adapter

The Keyman adapter shall isolate KeymanWeb from consumers and provide:

- explicit initialization and teardown;
- attachment to only the active supported input surface;
- approved keyboard selection by profile;
- touch-layout lifecycle;
- local-first asset loading;
- failure fallback to Standard + helper bar;
- version pinning and compatibility tests.

Keyman is an optional adapter, not a required global dependency for consumers that use only the helper bar.

### 5.5 Language profiles

Language behavior shall be data-driven. Each profile must contain:

- stable language-profile ID;
- BCP 47 language tag and documented variant/dialect scope;
- display name and autonym where approved;
- writing system and direction;
- base characters;
- helper-bar characters grouped by function;
- uppercase/lowercase relationships;
- combining marks and permitted sequences;
- preferred Unicode normalization form;
- approved fonts and fallback stack;
- approved Keyman keyboard ID and pinned version, when applicable;
- sample words and expected Unicode code-point sequences;
- linguistic reviewer, approval status, and revision date;
- provenance and licence metadata.

The initial Mandinka, Wolof, and Fula profiles must be reviewed separately. A shared character repertoire does not make their orthographies interchangeable.

## 6. User experience

### 6.1 Default behavior

For a first-time user, the default mode is Standard + helper bar. This keeps the familiar system keyboard while making missing characters visible.

The product shall expose an input control near its language selector with these choices:

- Standard;
- Helper;
- Full keyboard.

The labels may be localized, but the meaning and stored values must remain stable.

### 6.2 Remembering preferences

Remember the selected mode by:

1. user, when authenticated;
2. device/browser;
3. language profile;
4. product only when the user explicitly chooses a product-specific override.

Preference storage must not contain typed text. Anonymous preferences remain local. Authenticated cross-device preference synchronization is optional and must use a dedicated preference contract rather than token claims.

### 6.3 Helper bar

The helper bar shall:

- show only characters approved for the active language profile;
- support uppercase and lowercase without duplicating every key unnecessarily;
- provide touch targets of at least 44 by 44 CSS pixels;
- remain reachable by keyboard and assistive technology;
- identify keys with accessible names, language context, and Unicode value when useful;
- insert at the active selection through the configured editor adapter;
- remain usable in portrait mobile layouts without obscuring the writing area;
- support a compact and expanded state;
- never reorder itself based on captured user text without explicit consent.

Character ordering should be stable and linguistically meaningful. Frequently used characters may be prioritized only from approved, non-personal corpus evidence.

### 6.4 Full Keyman keyboard

The full keyboard shall be opt-in. Activating it must not unexpectedly replace the user's operating-system keyboard outside the product.

The interface shall provide:

- a clear return to Standard or Helper mode;
- the active language/layout name;
- first-use guidance;
- an explanation that the layout may differ from the device keyboard;
- graceful fallback when assets fail to load.

Where technically possible, the product should avoid showing two competing on-screen keyboards at once. Mobile behavior must be tested on physical Android and iOS devices rather than inferred from desktop emulation.

## 7. Unicode and text correctness

- Text must remain valid Unicode.
- The canonical normalization form must be declared per language profile; NFC is the default unless linguistic requirements specify otherwise.
- Normalization must occur at a documented boundary and must never change encrypted ciphertext or silently rewrite an existing document on load.
- Cursor calculations must be grapheme-aware rather than UTF-16-code-unit assumptions.
- Combining marks must attach to the intended base character.
- Visually identical but canonically different sequences must be covered by fixtures.
- The package must not silently transliterate, correct spelling, or replace a community-approved form.
- Copy, paste, search, save, reload, export, and synchronization must preserve the tested code-point sequence or its declared canonical equivalent.

## 8. Fonts

The package may distribute approved open-licence fonts needed for supported scripts.

Each bundled font must have:

- recorded licence and attribution;
- an explicit character-coverage test;
- a defined subset/full-font decision;
- local hosting for offline and privacy requirements;
- no dependency on a third-party font CDN at runtime.

Font availability must not be confused with keyboard or language support.

## 9. Offline and performance requirements

- Standard and Helper modes must work without network access once the consumer application is available.
- Keyman engine, approved keyboards, fonts, and profile data required for enabled languages must be cacheable and preferably self-hosted.
- A consumer may lazy-load Keyman only when Full keyboard is selected.
- Helper mode must not load the Keyman engine.
- Failure to load Keyman must not prevent typing or saving.
- The package shall publish size budgets for core, React, each profile, and the Keyman adapter.
- Consumer applications must be able to include only the language profiles they ship.

## 10. Privacy and security

- Input processing is local by default.
- No keystrokes, composed words, document fragments, clipboard contents, or character sequences may be logged or transmitted by this package.
- Metrics may record only non-content events such as selected mode, asset-load success, or fallback activation, subject to the host product's consent policy.
- External runtime CDN loading is prohibited in production unless explicitly accepted as a documented risk.
- Third-party keyboard code and packages must be version-pinned, licence-reviewed, integrity-checked, and included in dependency scanning.
- Language profiles are configuration, not authority. They must never grant access to documents, sessions, or classrooms.
- The package must remain compatible with encrypted editors without receiving encryption keys or plaintext outside the active in-memory editor boundary.

## 11. Accessibility

The package must meet WCAG 2.2 AA within its owned surfaces.

Required behaviors include:

- full keyboard navigation;
- visible focus;
- screen-reader labels for character keys and mode controls;
- no color-only state communication;
- support for zoom and reflow;
- reduced-motion compliance;
- correct language attributes;
- no focus trapping between native and Keyman keyboards;
- switch-control and mobile screen-reader testing;
- preservation of IME composition events.

## 12. Public API principles

The public API shall expose capabilities, not product assumptions.

Illustrative concepts:

- register one or more language profiles;
- choose an active language profile;
- choose an input mode;
- attach an editor adapter;
- insert an approved character;
- activate/deactivate the approved Keyman layout;
- subscribe to non-content lifecycle events;
- read/write a preference through a consumer-provided preference adapter.

The API shall not accept raw account roles, JWTs, document keys, dictionary records, or RLC session objects.

## 13. Integration contract for 3iAtlas products

Each consumer must:

- explicitly select the profiles it ships;
- provide a supported editor adapter;
- display the active language and input mode;
- keep normal typing available if the package fails;
- test save/reload and encrypted-document behavior;
- avoid duplicating or modifying the canonical character inventory locally;
- surface package version and profile revision in diagnostics;
- follow the package's conformance test suite.

WordPad is the Release 1 reference integration because it has the broadest writing surface and the strongest requirements for selection, undo, persistence, offline use, and encryption.

Dictionary and Games may initially use Helper mode only. RLC classroom writing surfaces may enable Full keyboard after the WordPad integration is proven on physical devices.

## 14. Testing and acceptance

### 14.1 Automated tests

- profile schema and licence validation;
- exact code-point fixtures for every approved sample;
- uppercase/lowercase behavior;
- combining-mark insertion;
- replacement of selections;
- grapheme-safe cursor placement;
- undo/redo through every adapter;
- IME composition preservation;
- normalization boundaries;
- offline helper mode;
- Keyman asset failure fallback;
- preference isolation by language/device/product;
- tree-shaking and bundle budgets;
- accessibility rules for owned React surfaces.

### 14.2 Device matrix

Release 1 must be tested on:

- a current Android phone with Gboard;
- a lower-resource Android device representative of target classrooms;
- a current iPhone;
- a current iPad;
- ChromeOS;
- desktop Chrome, Firefox, Safari, and Edge where supported by the consuming product.

Testing must include portrait/landscape changes, offline restart, background/foreground transitions, native keyboard switching, copy/paste, long documents, and reconnection.

### 14.3 Linguistic acceptance

For each initial profile, an approved reviewer must successfully:

- type the official alphabet and special characters;
- type the approved fixture words and sentences;
- confirm character ordering and labels;
- verify uppercase, diacritics, and combining behavior;
- save, close, reopen, copy, export, and search the text;
- compare rendered text and code points against the approved source.

Automated passing tests cannot substitute for linguistic acceptance.

## 15. Release plan

**Phase 0 — inventory and governance**

- Establish the repository and ownership documents.
- Define the profile schema.
- Build the exact approved character inventories for Mandinka, Wolof, and Fula/Fulfulde.
- Evaluate SIL Pan Africa Positional and language-specific Keyman keyboards against those inventories.
- Record keyboard and font licences.

**Phase 1 — helper mode and WordPad**

- Implement core, React bindings, and WordPad adapter.
- Ship Standard and Helper modes.
- Verify Android, iOS, desktop, offline, undo/redo, encryption, and document persistence.
- Make Helper the recommended default without changing existing users automatically.

**Phase 2 — KeymanWeb**

- Add the isolated Keyman adapter.
- Self-host pinned engine, keyboard, profile, and font assets.
- Ship Full keyboard as an opt-in setting.
- Run physical-device and accessibility testing.

**Phase 3 — platform adoption**

- Integrate Dictionary, Games, and RLC through published adapters.
- Add approved language profiles without consumer forks.
- Add conformance checks preventing local character-list drift.

**Phase 4 — advanced language support**

Only after evidence of need:

- predictive lexical models;
- additional scripts such as N'Ko or Adlam;
- community-approved custom Keyman layouts;
- optional cross-device preference sync.

These capabilities require separate privacy, licensing, linguistic, and product approval.

## 16. Release 1 gates

Release 1 is complete only when:

1. The three input modes have stable contracts, even if Full keyboard ships in Phase 2.
2. Mandinka, Wolof, and Fula profiles have named approval and exact Unicode fixtures.
3. WordPad supports Standard and Helper modes on the required device matrix.
4. Character insertion preserves selection, undo/redo, save/reload, encryption, and offline behavior.
5. No typed content leaves the device through this package.
6. Keyman and font licensing is recorded before their assets ship.
7. Failure of the package or Keyman never blocks ordinary typing or document recovery.
8. Accessibility acceptance is completed for the mode selector and helper bar.
9. Consumer applications import the canonical profiles rather than copying them.
10. Documentation states exactly which language variants and scripts are supported; no broad unsupported claim is used.

## 17. Open decisions

Decisions resolved for the first release, and those deliberately deferred
beyond it.

### Resolved for Release 1

| Decision                                            | Resolution                                                                                                                                                                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm scope and package names                         | `@starisian/3iatlas-multilingual-input`, with `-core`, `-adapters`, `-keyman`, `-profiles`, `-react` siblings.                                                                                                                                |
| Canonical Mandinka orthography                      | Gambian Mandinka in the Peace Corps The Gambia orthography is the chosen **target** for Release 1. AiWA has adopted that orthography as the target; it has **not** validated the shipped inventory. Review is pending with Muhammed Dibbasey. |
| Whether availability requires linguistic validation | No. The two are independent states. A licensed, pinned, tested keyboard may be used while AiWA review is outstanding; it may not be described as AiWA-validated.                                                                              |
| Whether Wolof and Fula block Release 1 engineering  | No. Both are available for engineering and product work while unreviewed, and neither may be presented as AiWA-validated.                                                                                                                     |
| Keyman asset distribution                           | Self-hosted only. Third-party CDN loading is refused at runtime by `KeymanWebAdapter.initialize`.                                                                                                                                             |
| Engine bundling                                     | The engine is not vendored in this repository. It is self-hosted per deployment, with its licence recorded in the profile before it ships.                                                                                                    |

### Deferred beyond Release 1

| Decision                                                                                                         | Why deferred                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Which Fula/Fulfulde regional variants require distinct profiles                                                  | Needs linguistic review that is not scheduled. Fula ships available and unreviewed until then.                                                   |
| Whether Wolof fixtures follow the Senegalese official orthography exclusively                                    | Same; no reviewer assigned.                                                                                                                      |
| Whether SIL Pan Africa Positional covers the Gambian Mandinka inventory, or a language-specific layout is needed | Cannot be answered before the inventory is reviewed. No Keyman keyboard is pinned for Mandinka until it is.                                      |
| Which open font provides required coverage at acceptable mobile size                                             | No font is bundled; section 8 licensing and coverage testing are outstanding.                                                                    |
| Whether authenticated input-mode preferences sync through a preference service                                   | Preferences are local-only in Release 1. The `PreferenceAdapter` contract already allows a consumer-supplied remote store without an API change. |
| Repository rename to `sparxstar-3iatlas-multilingual-input`                                                      | Cosmetic; the published package names are already correct.                                                                                       |

## 18. Governing product principle

Users must be able to type correctly without surrendering the keyboard habits they already possess. The platform provides progressively stronger assistance—standard keyboard, helper bar, then full Keyman keyboard—while the user remains in control.

## References

- Keyman: https://keyman.com/
- Keyman keyboard catalogue: https://keyman.com/keyboards
- SIL Pan Africa Positional: https://keyman.com/en/keyboards/sil_pan_africa_positional
- Keyman Engine integration: https://help.keyman.com/developer/engine/
- Keyman package format: https://help.keyman.com/developer/current-version/reference/file-types/kmp
