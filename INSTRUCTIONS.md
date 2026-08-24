# Repository Instructions

This document describes how to make a change in this repository. Mandatory coding
and runtime constraints remain authoritative in [`AGENTS.md`](AGENTS.md).

## Change workflow

1. Confirm the branch is not `main`.
2. Read the technical specification and inspect `ai_manifest.json` before designing
   a symbol.
3. Keep one logical change per branch and place authored code only under `src/`.
4. Add tests under `tests/` using the same relative structure as the source.
5. Update the manifest when a symbol is added, removed, moved, or renamed.
6. Run the validation pipeline in the order documented in `AGENTS.md`.
7. Review the diff for secrets, generated files in source directories, unsafe input
   handling, unbounded work, and accidental lockfiles.
8. Use a Conventional Commit and a PR title of `type(scope): description`.

## Definition of done

- The change is traced to a requirement in `TECHNICAL_SPEC.md`.
- Public behavior and failure behavior are documented.
- Every source file, class, method, function, global, and constant is documented.
- Security, privacy, internationalization, RTL behavior, keyboard access, and screen
  reader announcements have been considered.
- PHP 8.2 and 8.3 checks pass, and Node checks run with Node 20 and pnpm.
- Built files, if any, are reproducible and are written only to `assets/`.

## Review order

Reviewers should assess correctness and fail-closed behavior first, security and
privacy second, accessibility and internationalization third, and maintainability
and formatting last. A formatting improvement must never obscure a functional or
security change.
