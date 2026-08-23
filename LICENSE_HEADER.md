# Starisian Technologies License Headers

This file defines the required license header for every source file in this repository.

Copy the appropriate header into every source file in a Starisian Technologies project.

---

## Full License Header

Use in all primary source files (e.g., main modules, core libraries, dataset processors).

Every `.js` and `.py` source file (excluding `__init__.py`) must begin with the appropriate header block below. The CI `license-headers` job enforces this on every PR.

```
/************************************************************************
 * STARISIAN TECHNOLOGIES PROPRIETARY AND CONFIDENTIAL
 * __________________
 *
 * Copyright © 2026 Starisian Technologies (Max Barrett)
 * All Rights Reserved.
 *
 * NOTICE: All information, technical concepts, and intellectual property
 * contained herein are, and remain the property of Starisian Technologies.
 * This material is protected by trade secret, copyright, and patent law.
 *
 * Access to this software is granted strictly under the terms of a
 * Starisian Technologies Service Agreement, Commercial License, or
 * Employment Agreement. Dissemination, reproduction, or reverse
 * engineering of this material is strictly forbidden unless prior
 * written permission is obtained from Starisian Technologies.
 ************************************************************************/
```

---

## Short License Header

Use in secondary or supporting files (e.g., utility helpers, config files, templates).

```
/************************************************************************
 * STARISIAN TECHNOLOGIES - PROPRIETARY AND CONFIDENTIAL
 * Copyright © 2026 Starisian Technologies (Max Barrett)
 * PATENT PENDING — Inventors: Max Barrett (@MaximillianGroup), Obafa (@Obafa, select applications)
 * Jurisdiction: Los Angeles, CA
 ************************************************************************/
```

---


## JavaScript / Node.js Header


javascript

```
/**
 * Copyright (c) Starisian Technologies. All rights reserved.
 *
 * This file is part of the SPARXSTAR platform and is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file, via any medium,
 * is strictly prohibited except as expressly permitted in writing by Starisian Technologies.
 *
 * License: Business Source License 1.1
 * Change Date: January 1, 2036
 * Change License: Starisian Community License
 *
 * See the LICENSE file in the repository root for full license terms.
 */
```

---

## Python Header


python

```
# Copyright (c) Starisian Technologies. All rights reserved.
#
# This file is part of the SPARXSTAR platform and is proprietary and confidential.
# Unauthorized copying, modification, distribution, or use of this file, via any medium,
# is strictly prohibited except as expressly permitted in writing by Starisian Technologies.
#
# License: Business Source License 1.1
# Change Date: January 1, 2036
# Change License: Starisian Community License
#
# See the LICENSE file in the repository root for full license terms.
```

---

## Notes


-   `__init__.py` files are exempt --- they may be empty or contain only package declarations.
-   The CI check scans for the string `Copyright (c) Starisian Technologies` as the presence marker.
-   Headers must appear before any other content in the file (including docstrings and imports).
-   For Python files, the header appears before the module docstring.

*© 2026 Starisian Technologies (Max Barrett). All Rights Reserved. Patent Pending.*
