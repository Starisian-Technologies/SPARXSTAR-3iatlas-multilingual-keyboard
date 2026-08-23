# 3iAtlas Multilingual Input

Monorepo scaffold for the 3iAtlas multilingual input package family.

## Packages

- `@starisian/3iatlas-multilingual-input-core`
- `@starisian/3iatlas-multilingual-input-react`
- `@starisian/3iatlas-multilingual-input-adapters`
- `@starisian/3iatlas-multilingual-input-keyman`
- `@starisian/3iatlas-multilingual-input-profiles`
- `@starisian/3iatlas-multilingual-input`

## Tooling

- Package manager: `pnpm`
- Language: TypeScript (`strict: true`)
- Lint: ESLint
- Test: Jest + ts-jest
- Build: TypeScript package builds per workspace module

## Quick start

```bash
corepack enable
corepack prepare pnpm@9.12.1 --activate
pnpm install
pnpm run lint:js
pnpm test
pnpm run build
```

## Initial scope

This scaffold establishes module boundaries for:

- input mode modeling (`standard`, `helper`, `full-keyboard`)
- language profile contracts and release-one profile data
- adapter contracts for native input, controlled React input, and WordPad
- isolated Keyman adapter interface and no-op fallback behavior

See `/docs/ARCHITECTURE.md` for the initial module map.
