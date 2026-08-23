# Starisian Technologies Proprietary License

> **Template Repository** — Use this as the canonical source for all Starisian Technologies license language, file headers, and governance documents.

---

## Overview

This repository contains the official **Starisian Technologies Proprietary License** language, code ownership policies, and CI workflow templates. It is intended to be used as a **GitHub Template Repository** so that all new Starisian Technologies projects inherit consistent licensing, security, and governance scaffolding from day one.

**Lead Developer / IP Owner:** Max Barrett ([@StarisianDevelopment](https://github.com/starisiandevelopment))  
**Organization:** [Starisian Technologies](https://github.com/Starisian-Technologies) / Max Barrett  
**Jurisdiction:** Los Angeles, California

---

## Repository Contents

| File / Path | Purpose |
|---|---|
| [`LICENSE.md`](./LICENSE.md) | Full proprietary license (public & private/commercial variants) |
| [`LICENSE_HEADER.md`](./LICENSE_HEADER.md) | Copy-paste license headers for source files (full & short) |
| [`CODE_OWNERSHIP.md`](./CODE_OWNERSHIP.md) | Technical governance and code ownership policy |
| [`.github/CODEOWNERS`](.github/CODEOWNERS) | GitHub CODEOWNERS file — auto-assigns @MaximillianGroup to all reviews |
| [`SECURITY.md`](./SECURITY.md) | Vulnerability reporting policy |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Contribution and CLA policy |
| [`.github/workflows/lint-and-syntax.yml`](.github/workflows/lint-and-syntax.yml) | CI: PHP syntax lint + Node.js audit |
| [`.github/workflows/core-testing.yml`](.github/workflows/core-testing.yml) | CI: Python linting + conditional Node.js install/audit when `package.json` is present |

---

## Using This Template

1. Click **"Use this template"** on GitHub to create a new repository under the Starisian Technologies organization.
2. Copy the appropriate license header from [`LICENSE_HEADER.md`](./LICENSE_HEADER.md) into every source file.
3. The `.github/CODEOWNERS` file automatically assigns `@StarisianDevelopment` as a required reviewer for all pull requests.
4. The included GitHub Actions workflows will run on every push and pull request.

---

## License

All files in this repository — including the license text itself — are the exclusive property of **Starisian Technologies**.  
See [`LICENSE.md`](./LICENSE.md) for full terms.

**This software is NOT open source.** Viewing this repository on GitHub does not grant any rights beyond those explicitly stated in `LICENSE.md` and the [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

*© 2026 Starisian Technologies (Max Barrett). All Rights Reserved. Patent Pending.*
