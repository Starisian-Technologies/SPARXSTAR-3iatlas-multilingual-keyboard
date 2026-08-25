# Language profile review status

Two independent states are tracked per profile. Conflating them either blocks
shippable engineering work or makes false claims about a language.

| State                     | Meaning                                                                                                       | Gate                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Availability**          | A licensed, version-pinned keyboard loads and passes input tests. The profile may be selected and typed with. | `isKeyboardAvailable`       |
| **Linguistic validation** | AiWA has reviewed the exact language, orthography, script, and regional variant.                              | `isLinguisticallyValidated` |

**A keyboard may be available without AiWA having certified the language.**
Never describe an unvalidated profile as AiWA-validated, certified, or
approved. Render `describeValidationStatus( profile )` verbatim rather than
inventing wording; a CI guard fails the build if that string would claim
validation for an unvalidated profile.

## Current state

| Profile                          | Available         | AiWA validated        | Reviewer          |
| -------------------------------- | ----------------- | --------------------- | ----------------- |
| Gambian Mandinka (`mnk-Latn-GM`) | Yes — Helper mode | **No — pending**      | Muhammed Dibbasey |
| Wolof (`wo-Latn-SN`)             | Yes — Helper mode | **No — not reviewed** | Unassigned        |
| Fula / Fulfulde (`ff-Latn-SN`)   | Yes — Helper mode | **No — not reviewed** | Unassigned        |

No profile pins a Keyman keyboard yet, so "available" currently means Helper
mode. See [`KEYMAN-DEPLOYMENT.md`](KEYMAN-DEPLOYMENT.md).

## Gambian Mandinka — first integration, review pending

Product decision: Gambian Mandinka in the Peace Corps The Gambia orthography
already adopted by AiWA. This is the first end-to-end integration and is
exercised by the browser suite on desktop and mobile viewports.

### What changed and why

The previous inventory was ten accented Latin vowels
(`á à é è í ì ó ò ú ù`). That is a generic diacritic set, not a Mandinka
repertoire, and it has been removed rather than carried forward.

The replacement reflects the Latin orthography used for Mandinka in The Gambia:

- `ŋ` (U+014B) and `ñ` (U+00F1), with their uppercase forms `Ŋ` and `Ñ` — the
  letters a writer cannot produce from a stock QWERTY or AZERTY keyboard, which
  is precisely what the helper bar exists to supply;
- long vowels written as doubled vowels (`aa ee ii oo uu`), not as diacritics;
- no tone marking, and therefore no permitted combining sequences.

### What is still outstanding

**This inventory was not verified against the Peace Corps source document.**
That document was not reachable from the build environment. The inventory is
therefore a starting point for review, not a reviewed artifact, and
`validation.status` is `pending`.

Muhammed Dibbasey must confirm, per specification section 14.3:

- the complete alphabet and every special character;
- whether the doubled-vowel treatment belongs in the helper bar or only in the
  base inventory;
- character ordering and the accessible label for each key;
- uppercase behavior for `ŋ` and `ñ`;
- **the fixture words and their exact code-point sequences** — `fixtures` is
  deliberately empty because those must come from the reviewer, never from an
  engineer;
- whether SIL Pan Africa Positional covers this inventory or a language-specific
  Keyman layout is required.

Setting `validation.status` to `validated` without a reviewer name, a review
date, and fixtures is rejected by `validateLanguageProfile` and by CI.

## Wolof — engineering unblocked, orthography unreviewed

Available for engineering and product work. Section 17 leaves open whether
Release 1 follows the Senegalese official orthography exclusively; the profile
names that as its target but claims no review, and its inventory is carried
over from the initial scaffold uncited.

## Fula / Fulfulde — engineering unblocked, variant unresolved

Available for engineering and product work. Section 17 leaves the regional
variant split unresolved, so the profile records its variant as unresolved
rather than asserting a single Senegalese variant. Its inventory is carried
over uncited.
