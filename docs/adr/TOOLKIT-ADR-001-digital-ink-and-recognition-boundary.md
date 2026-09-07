# TOOLKIT-ADR-001 — Digital ink in the toolkit, recognition outside it

- **Status:** Accepted for the capture half; the recognition half is GATED and
  awaits AiWA and owner ratification (see Decision 2).
- **Date:** 2026-09-06
- **Scope:** `SPARXSTAR-3iatlas-multilingual-keyboard`, with named obligations
  on `sparxstar-3iatlas-wordpad` and the Dictionary.
- **Supersedes:** nothing. Extends `TECHNICAL_SPEC.md`.

## Context

This repository was keyboard-only: three input modes, a helper bar of approved
characters, and an optional Keyman layout. The ask was to widen it into the
3iAtlas Input Toolkit — adding digital ink so a writer can use a pencil, with
handwriting recognition proposing Mandinka words drawn from the approved
Dictionary lexicon.

Three constraints in force here pull against a naive implementation:

1. `TECHNICAL_SPEC.md` §10 forbids this package transmitting "keystrokes,
   composed words, document fragments, clipboard contents, or character
   sequences". §4 forbids transmitting typed content to any external service.
   Handwriting is composed content by any reading.
2. Africa-first means lowest bandwidth. A recognition SDK is not free.
3. Sovereignty defaults are not an engineering decision.

## Decision 1 — Digital ink lives here; the vector record is the artifact

Ink capture, editing, serialization, and rendering ship in
`@starisian/3iatlas-input-ink`, built on native Pointer Events and
`perfect-freehand` (MIT, 1.2.3, ~2 KB gzipped).

The persisted artifact is a versioned VECTOR record — ordered coordinates,
pressure, per-point time offset, pointer type, tool type, and canvas
dimensions — not a flattened image. A raster can always be regenerated from
strokes; strokes cannot be recovered from a raster.

`INK_SCHEMA_VERSION` is a hard gate. A reader that does not recognize the
version refuses the document rather than guessing at fields, because a
partially-read page looks saved and is not.

Pressure that the device did not report is recorded as `NO_PRESSURE` (-1),
never as the `0.5` the Pointer Events specification has unsupported devices
report. "No pressure data" survives serialization as a fact.

## Decision 2 — Recognition is a PORT here, and an implementation elsewhere

`@starisian/3iatlas-input-recognition` defines `HandwritingRecognizer` and
nothing that implements it against a vendor. The package makes NO network
request of any kind. The default recognizer is `UnavailableRecognizer`, and
every other capability — writing, editing, erasing, undo, save, reopen,
confirming a spelling — works with it in place.

**No handwriting leaves SPARXSTAR under this ADR.** A recognition provider is
enabled only when AiWA (Muhammed Dibbasey) has approved external processing
for this data and the governance exception to §10/§4 is recorded. Until then
the shipped default is off, and turning it on is a deliberate act by a
consuming product, not a configuration default.

### Why the vendor adapter is not in this repository

The ask named MyScript `iink-ts` as the first adapter. Verified against
`iink-ts@4.1.0`'s own type definitions and package contents:

- `TServerHTTPConfiguration` requires `applicationKey: string` and
  `hmacKey: string | ((applicationKey: string) => Promise<string>)`. The
  callback form returns the HMAC KEY, not a signature, so the secret is in
  browser memory either way. `computeHmac(message, applicationKey, hmacKey)`
  runs client-side.
- Its `host` is MyScript's own, so its network layer bypasses any BFF.
- `dist/iink.esm.js` is 599 KB raw / **136.5 KB gzipped** — against a 150 KB
  gzipped app budget, on the lowest-bandwidth platform in the portfolio.

Any of those alone rules out shipping it in the browser bundle. Owner ruling,
2026-09-06: the browser and the Input Toolkit carry `perfect-freehand` only;
the WordPad backend owns any recognition-provider adapter and the credentials
it needs; the Dictionary publishes the approved lexicon and never calls a
recognition provider.

## Decision 3 — Suggestions, never substitutions

Enforced by the shape of the API rather than by review discipline:

- Recognizing cannot insert. `propose()` returns candidates and has no path to
  an editor. Text reaches a document only through a `confirm*` call that a
  person's action triggers. There is no highest-confidence default and no
  timeout that picks one.
- Confirmed text is inserted VERBATIM. `insertTranscription` deliberately does
  not normalize, unlike `insertCharacter` — a single approved character is
  package data, but a confirmed word is what a person read and accepted, and
  rewriting it is precisely the silent substitution this forbids.
- Lexicon lookup is by exact code points. No case folding, no diacritic
  stripping, no decomposition. Two Mandinka words that differ by a diacritic
  are different words.
- A candidate the approved lexicon does not carry is LABELLED, in text, and is
  still confirmable. "Not in the dictionary" is not "wrong", and an
  English-looking candidate is never promoted over a Mandinka one.
- Lexicon entries that are not in NFC are REFUSED, not normalized. NFC is the
  platform's canonical form, so a non-NFC artifact is a publishing fault;
  repairing it here would hide the fault and, on some orthographies, change
  which letters a writer sees.

## Decision 4 — Two records, linked, both kept

`InkTranscription` records what a person confirmed some strokes say, joined to
the ink by `inkDocumentId` and `strokeIds`, plus the `lexiconEntryId` and
`lexiconRevision` a match was made against. The ink is never edited to agree
with the reading. `isTranscriptionIntact` reports when a reading's evidence has
been erased, so a consumer can stop presenting it as handwriting-backed.

This is what makes a future recognition model evaluable against real Mandinka
handwriting without anyone touching the original document evidence.

## Decision 5 — The toolkit owns input; products own workflows

`offerUnlistedWord` returns an `UnlistedWordEvidence` value and does nothing
with it. This package cannot and must not add a word to the approved
Dictionary. Routing evidence into review is the consuming product's job —
WordPad's own `ROLE.md` records that its submissions go through Sky, and ESU
is never WordPad's direct destination.

Document ownership, synchronization, encryption, linguistic approval, and
Dictionary publication stay outside this repository.

## Divergences from standing rules, for ratification

1. **`TECHNICAL_SPEC.md` §10 / §4 — transmitting composed content.** The
   recognition port exists so that a product CAN send ink somewhere. Nothing
   ships enabled, and this package still transmits nothing itself, but the
   capability is new and the exception needs recording before any deployment
   turns it on. **Owner and AiWA sign-off required.**
2. **`AGENTS.md` execution budget — "max event handler rate 10 Hz".** Ink
   capture cannot sample a pen at 10 Hz and stay legible. The implementation
   keeps the pointer handler trivial (it appends to an array), batches every
   repaint into one `requestAnimationFrame` (≤ ~60 Hz, well inside the 50 ms
   main-thread block cap), and uses `getCoalescedEvents()` so the browser hands
   over every sample it took between frames. That honours the intent — bounded
   main-thread work — while diverging from the literal rate. **Recommend
   ratifying the rule as a rendering-rate cap rather than a listener-rate cap.**
3. **Bundle budgets raised.** `react` 4→5 KB and `multilingual-input` 1→3 KB
   gzipped, reflecting the ink bindings and the toolkit facade;
   `ink` (11 KB) and `recognition` (6 KB) are new. `ink` and `recognition` were
   added to `FORBIDDEN_IN_HELPER_PATH`, so a Helper-only consumer still cannot
   be made to download a handwriting engine. Helper-only path remains ~5.5 KB
   gzipped.

## Obligations on other repositories

**WordPad** (`sparxstar-3iatlas-wordpad`) — owns, when and only when Decision 2
is ratified:

- A recognition route on its Dictionary BFF pattern, holding the MyScript
  `applicationKey`/`hmacKey` as Worker secret bindings, never as browser
  configuration. Its existing `workers/dictionary-bff` is the model:
  same-origin path, fixed route allowlist, no passthrough.
- A route serving the approved lexicon manifest and artifacts to the browser.
  **No such route exists today** on either Dictionary surface reachable from a
  browser, which is why `LexiconFetcher` is consumer-supplied here.
- Routing `UnlistedWordEvidence` into its own submission flow.

**Dictionary** — publishes the compact lexicon artifact and manifest this
toolkit reads. `SPELL_LEXICON_SCHEMA_VERSION` in
`packages/recognition/src/lexicon.ts` is this repository's single definition of
that shape, and must be reconciled against the publisher's JSON Schema rather
than the reverse: the publisher owns the shape, this is the reader.

## Consequences

- A writer with no connectivity can write, edit, erase, undo, redo, clear,
  save, reopen, export, and keep their own spelling. Only suggestions are lost.
- A product that ships only the helper bar downloads no ink code.
- Swapping recognition providers, or running none, changes no ink code.
- The toolkit cannot leak a recognition credential, because it never holds one.
