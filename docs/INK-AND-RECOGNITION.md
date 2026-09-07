# Digital ink and handwriting recognition

How to use the pencil half of the 3iAtlas Input Toolkit. The decisions behind
it, and what still needs owner sign-off, are in
[`adr/TOOLKIT-ADR-001`](adr/TOOLKIT-ADR-001-digital-ink-and-recognition-boundary.md).

## What ships, and what does not

| Package                                       | Contains                                                                         | Network |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ------- |
| `@starisian/3iatlas-input-ink`                | Capture, model, undo/redo, erase, select, serialize, render, SVG/PNG export      | none    |
| `@starisian/3iatlas-input-recognition`        | Recognizer port, lexicon contract, versioned cache, suggestion/confirmation flow | none    |
| `@starisian/3iatlas-multilingual-input`       | Toolkit facade over keyboard + pencil, DOM helper bar                            | none    |
| `@starisian/3iatlas-multilingual-input-react` | `InkCanvas`, `RecognitionSuggestions`                                            | none    |

**No package in this repository makes a network request.** Recognition and
lexicon transport are supplied by the consuming product, which owns its own
authenticated endpoints and credentials.

## Mounting ink

```ts
import { mountInkSurface } from '@starisian/3iatlas-input-ink';

const surface = mountInkSurface(hostElement, {
	label: 'Handwriting area',
	onStrokeEnd: (stroke) => console.log(stroke.pointerType),
});

surface.setTool('highlighter');
surface.setMode('erase');
surface.undo();
const page = surface.serialize(); // an InkDocument
const svg = surface.toSvg({ trim: true });
const png = await surface.toPngBlob(); // null where the platform declines
```

In React, `InkCanvas` mounts the surface and renders an accessible toolbar.
Hand the surface to the facade with `toolkit.attachInkSurface(surface)` so one
object drives both input paths — and re-attach whenever you rebuild the
toolkit, or it will have nothing to recognize.

## Saving and reopening

`serializeInkDocument` writes JSON; `parseInkDocument` reads it and REFUSES
anything malformed rather than partially repairing it:

```ts
const parsed = parseInkDocument(savedJson);

if (!parsed.ok) {
	// parsed.issues names the field and the reason. Do not open a partial page.
	return;
}

surface.restore(parsed.document);
```

Resizing the canvas never rewrites captured points — the renderer scales at
draw time — so reopening at the original size is lossless.

## Supplying a recognizer

Implement `HandwritingRecognizer` against your product's own authenticated
server-side endpoint:

```ts
const recognizer: HandwritingRecognizer = {
	id: 'my-product-bff',
	isAvailable: () => navigator.onLine,
	supportedLanguages: () => ['mnk-Latn-GM'],
	recognize: async (request) => {
		// request.strokes, request.languageTag, request.lexiconRevision.
		// YOUR fetch, YOUR origin, YOUR credentials. Never a vendor key here.
	},
};
```

Omit it and `UnavailableRecognizer` is used: suggestions report why they are
unavailable, and everything else keeps working.

## The approved lexicon

The Dictionary publishes a compact lexicon per language, plus a manifest. This
package reads them; it never builds, edits, or writes back to one.

`SPELL_LEXICON_SCHEMA_VERSION` in `packages/recognition/src/lexicon.ts` is this
repository's single definition of that shape. Reconcile it against the
publisher's JSON Schema — the publisher owns the shape.

```ts
const cache = new LexiconCache(myStore);
const entries = readLexiconManifest(await myFetchManifest());

for (const entry of entries) {
	await cache.refresh(entry, (e) => myFetchArtifact(e));
}

const index = await cache.load('mnk');
```

Freshness is decided by the publisher's REVISION, never by a local timer, and
the order of operations is deliberate:

1. Revision unchanged → nothing is downloaded at all.
2. Checksum verified against the manifest's SHA-256 → a corrupted download is
   rejected on its bytes, before parsing.
3. Payload parsed and cross-checked against the manifest's revision and
   language → published-out-of-step artifacts are refused.
4. Only then is the stored copy replaced.

A failed refresh always leaves the previous working lexicon in place. Where
Web Crypto is unavailable — an insecure context — the cache fails CLOSED and
installs nothing, rather than trusting bytes nothing vouched for.

## Rules the code enforces

- **Nothing is inserted by recognizing.** Confirmation is a separate call a
  person's action must trigger.
- **Confirmed text is inserted verbatim.** No normalization, case change,
  diacritic stripping, vowel shortening, or digraph splitting on this path.
- **Lookup is by exact code points.** `kuŋo` and a decomposed spelling of it
  are different strings, and the toolkit never treats one as the other.
- **An accepted variant matches as itself**, not as its headword, so
  confirming a regional spelling inserts that spelling.
- **A withdrawn entry is never suggested** and never reported as approved.
- **With no lexicon loaded, nothing is reported as approved.** Not checked is
  not approved.
- **Non-NFC lexicon data is refused, not normalized.**

## Offline behavior

| Capability                                     | Offline                                |
| ---------------------------------------------- | -------------------------------------- |
| Write, erase, undo/redo, select, clear         | works                                  |
| Save, reopen, SVG/PNG export                   | works                                  |
| Keep your own spelling, record a transcription | works                                  |
| Cached approved-lexicon lookup                 | works                                  |
| Recognition suggestions                        | unavailable, with a stated reason      |
| Lexicon refresh                                | deferred until a manifest is reachable |

## Browser and device limits

- **Pressure** cannot be probed ahead of a stroke — no API answers "will the
  next stroke carry pressure". `detectCapabilities().pressure` is deliberately
  `null`; read `hasPressureData(stroke)` from a captured stroke instead.
- **Palm rejection** is a heuristic, not a browser feature. Contact size is
  only meaningful where the touchscreen measures it; devices that do not report
  `1` and are always accepted. The policy degrades toward drawing, because a
  refused stroke is worse than a stray mark the writer can undo.
- **`getCoalescedEvents`** is absent on some engines. Capture still works,
  sampling at frame rate rather than device rate — slightly coarser strokes.
- **`ResizeObserver`** absent falls back to a window `resize` listener.
- **`toPngBlob`** resolves to `null` where the platform declines to rasterize.
  Handle it; do not treat it as an empty page. SVG export has no such limit.
- **Web Crypto** is secure-context only, which the checksum path depends on.
