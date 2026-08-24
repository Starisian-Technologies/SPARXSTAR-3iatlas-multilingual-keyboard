# GitHub Copilot Instructions

Before suggesting or reviewing a change, read and follow the repository-root
`AGENTS.md`, `INSTRUCTIONS.md`, `TECHNICAL_SPEC.md`, and `ai_manifest.json` files.
Treat `AGENTS.md` as mandatory and fail closed when a proposed behavior lacks an
approved contract. Do not invent product requirements, namespaces, permissions,
locales, linguistic data, or external services.

Keep authored PHP and TypeScript in `src/`, mirror source paths in `tests/`, and
write generated output only to `assets/`. Use strict types, named TypeScript exports,
WordPress APIs, localized user-visible strings, logical CSS properties, bounded
execution, and accessible native controls. Document every source file and symbol,
and update `ai_manifest.json` whenever a symbol changes.

Use pnpm exclusively for Node dependencies. Never create `package-lock.json` or
`yarn.lock`. Before proposing completion, run the checks in the order specified by
`AGENTS.md` and report any check that could not run.
