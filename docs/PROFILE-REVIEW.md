# Language profile review status

**No language in this repository is supported.** Every profile ships with
`approval.status: 'provisional'`, and `isSupportedProfile` returns `false` for
all of them. `selectSupportedProfiles(DRAFT_PROFILES)` returns an empty array.
That is the intended state until linguistic acceptance is recorded.

Specification section 4 forbids claiming support for a language merely because
its characters render, and forbids replacing linguistic review with a generic
Pan-African character inventory. Section 16 gate 10 requires documentation to
state exactly which variants and scripts are supported, with no broad claim.

## Why the profiles were withdrawn

The inventories were assembled during scaffolding without a cited orthographic
source, a reviewer, or a licence. They were previously exported as
`RELEASE_ONE_PROFILES`, a name that implied release readiness they had not
earned. They are now exported as `DRAFT_PROFILES` and are review input only.

## What every profile is missing

Required by specification section 5.5, absent from all three profiles:

| Requirement                                         | Status                   |
| --------------------------------------------------- | ------------------------ |
| Documented variant / dialect scope                  | Missing                  |
| Base character inventory                            | Empty                    |
| Uppercase / lowercase relationships                 | Empty                    |
| Combining marks and permitted sequences             | Empty                    |
| Approved fonts and fallback stack                   | None; licence unrecorded |
| Approved Keyman keyboard ID and pinned version      | None; licence unrecorded |
| Sample words with expected code-point sequences     | Empty                    |
| Linguistic reviewer, approval status, revision date | Unreviewed               |
| Provenance and licence metadata                     | Uncited, uncleared       |

## Per-language concerns

### Mandinka (`mandinka-latn-gm`) — inventory disputed

The helper inventory contains only accented Latin vowels
(`á à é è í ì ó ò ú ù`). Mandinka orthography is generally understood to require
characters absent from that list, so the inventory is very likely wrong and not
merely incomplete. It appears to be a generic diacritic set rather than a
Mandinka repertoire.

The inventory has deliberately **not** been amended. Correcting it here would be
exactly the substitution of engineering judgment for linguistic review that
section 4 prohibits. Section 17 also records that the canonical Mandinka
orthography and variant for Release 1 is still an open decision, so there is no
approved target to correct it toward.

### Wolof (`wolof-latn-sn`) — unverified

Section 17 leaves open whether Release 1 fixtures follow the Senegalese official
orthography exclusively. The profile asserts `wo-Latn-SN` without that decision
having been made.

### Fula / Fulfulde (`fula-latn-sn`) — variant split unresolved

Section 17 leaves open which regional variants require distinct profiles. The
profile asserts a single `ff-Latn-SN` profile, which presupposes an answer.

## What approval requires

Per section 14.3, an approved reviewer must type the official alphabet and
special characters, type the approved fixture words and sentences, confirm
character ordering and labels, verify uppercase, diacritics, and combining
behavior, save/close/reopen/copy/export/search the text, and compare rendered
text and code points against the approved source. Automated tests cannot
substitute for this.

Once complete, set `approval.status` to `'approved'` and populate `reviewer`,
`approvedAt`, and `fixtures`. `validateLanguageProfile` rejects an `approved`
profile that lacks any of those three, so the status cannot be set alone.
