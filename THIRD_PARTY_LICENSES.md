# Third-Party Licenses

This project (the AIOS Self-Assessment Tool and Learning Journey) is licensed under the GNU Lesser General Public License v3.0 (`LGPL-3.0-only`), see [LICENSE](LICENSE).

It builds on open-source software from third parties. This file lists those components and their licenses. Each license applies to its own component only, and the full license texts are included with each package in `node_modules/` after `npm install`.

## Summary

- All runtime dependencies use permissive licenses (MIT, ISC, BSD, Apache-2.0, 0BSD) or the file-level copyleft license MPL-2.0 (`@pie-framework/mathquill`, used by the PIE math input). These licenses are compatible with LGPL-3.0.
- No runtime dependency uses a GPL, AGPL or other strong copyleft license.
- For some packages the npm registry gives no license. For `@pie-framework/pie-fixed-player-static` and React Router, the license is taken from the package itself (MIT). For the PIE question packages (`@pie-element/*`, `@pie-lib/*`), the source repository, [pie-elements-ng](https://github.com/pie-framework/pie-elements-ng), is MIT-licensed, with portions ported from pie-elements and pie-lib under the ISC license.
- Development tools (test, lint, build) are not shipped with the application. They are listed separately at the end.

| Package | Runtime packages | Development-only packages |
|---|---|---|
| `frontend` | 233: MIT (212), MIT (portions ISC) (11), BSD-3-Clause (3), ISC (3), MPL-2.0 (1), (MPL-2.0 OR Apache-2.0) (1), 0BSD (1), Apache-2.0 (1) | 410: MIT (340), Apache-2.0 (22), ISC (19), BSD-2-Clause (9), BSD-3-Clause (7), BlueOak-1.0.0 (6), MIT-0 (2), CC0-1.0 (2), Python-2.0 (1), MPL-2.0 (1), CC-BY-4.0 (1) |
| `backend` | 111: MIT (93), Apache-2.0 (12), ISC (3), BSD-3-Clause (2), BSD-2-Clause (1) | 287: MIT (239), Apache-2.0 (16), ISC (14), BSD-2-Clause (6), BSD-3-Clause (6), BlueOak-1.0.0 (5), Python-2.0 (1) |
| `database` | 36: MIT (29), Apache-2.0 (7) | 246: MIT (197), Apache-2.0 (16), ISC (15), BSD-2-Clause (6), BSD-3-Clause (6), BlueOak-1.0.0 (5), Python-2.0 (1) |

## Direct runtime dependencies

These are the packages the application depends on directly (`dependencies` in each `package.json`).

| Package | Version | License | Used in | Purpose |
|---|---|---|---|---|
| `@pie-element/match` | 13.0.7 | MIT (portions ISC) | frontend | PIE matching question type |
| `@pie-element/placement-ordering` | 15.0.7 | MIT (portions ISC) | frontend | PIE ordering question type |
| `@pie-framework/pie-fixed-player-static` | 1.0.0-963a099.1 | MIT | frontend | PIE player that renders the question items |
| `@prisma/client` | 5.22.0 | Apache-2.0 | backend, database | Database client (ORM) |
| `cors` | 2.8.6 | MIT | backend | CORS headers |
| `express` | 4.22.3 | MIT | backend | HTTP server |
| `express-rate-limit` | 8.7.0 | MIT | backend | Rate limiting |
| `google-auth-library` | 9.15.1 | Apache-2.0 | backend | Verifies Google sign-in tokens |
| `helmet` | 8.3.0 | MIT | backend | Security headers |
| `jsonwebtoken` | 9.0.3 | MIT | backend | Session tokens (JWT) |
| `prisma` | 5.22.0 | Apache-2.0 | database | Database schema and migrations |
| `react` | 18.3.1 | MIT | frontend | UI library |
| `react-dom` | 18.3.1 | MIT | frontend | React renderer for the browser |
| `react-router-dom` | 6.30.6 | MIT | frontend | Routing in the frontend |
| `three` | 0.186.1 | MIT | frontend | 3D background graphics |
| `tsx` | 4.23.15 | MIT | database | Runs TypeScript scripts (seed and content sync) |

## Models, services and container images

These are not npm packages and are not included in the repository, but the system depends on them when it runs.

| Component | License or terms | How it is used |
|---|---|---|
| [gpt-oss-120b](https://huggingface.co/openai/gpt-oss-120b) (OpenAI) | Apache-2.0 (open-weight model) | Generates the AI advice. Hosted by NTNU (IDUN) and reached through an OpenAI-compatible API. The model can be changed with `LLM_MODEL`. |
| Google Identity Services (`accounts.google.com/gsi/client`) | [Google APIs Terms of Service](https://developers.google.com/terms) | Google sign-in. Loaded from Google at runtime, not distributed with the project. |
| ORCID OAuth API | [ORCID Public API Terms](https://info.orcid.org/public-client-terms-of-service/) | ORCID sign-in. |
| `mysql:8.4` Docker image | GPL-2.0 (MySQL Community Edition) | Database server. Runs as a separate service, so its license does not extend to this project. |
| `node:20-slim` Docker image | Node.js: MIT. Base image: Debian packages under their own licenses | Runtime for the backend and the database scripts, and for building the frontend. |
| `nginx:1.27-alpine` Docker image | nginx: BSD-2-Clause. Base image: Alpine packages under their own licenses | Serves the built frontend. |

## Logos and trademarks

The EU funding emblem and the IKY (State Scholarships Foundation) logo in the frontend are not covered by the LGPL-3.0 license of this project. They are used to acknowledge the funding of the AIOS project and must follow the owners' rules for use.

## All runtime packages

Direct and indirect dependencies that are part of the running application.

<details>
<summary>Show the full list</summary>

| Package | Version | License | Used in |
|---|---|---|---|
| `@babel/code-frame` | 7.29.7 | MIT | frontend |
| `@babel/generator` | 7.29.8 | MIT | frontend |
| `@babel/helper-globals` | 7.29.7 | MIT | frontend |
| `@babel/helper-module-imports` | 7.29.7 | MIT | frontend |
| `@babel/helper-string-parser` | 7.29.7 | MIT | frontend |
| `@babel/helper-validator-identifier` | 7.29.7 | MIT | frontend |
| `@babel/parser` | 7.29.8 | MIT | frontend |
| `@babel/runtime` | 7.29.7 | MIT | frontend |
| `@babel/template` | 7.29.7 | MIT | frontend |
| `@babel/traverse` | 7.29.8 | MIT | frontend |
| `@babel/types` | 7.29.8 | MIT | frontend |
| `@dnd-kit/accessibility` | 3.1.1 | MIT | frontend |
| `@dnd-kit/core` | 6.3.1 | MIT | frontend |
| `@dnd-kit/modifiers` | 9.0.0 | MIT | frontend |
| `@dnd-kit/sortable` | 10.0.0 | MIT | frontend |
| `@dnd-kit/utilities` | 3.2.2 | MIT | frontend |
| `@emotion/babel-plugin` | 11.13.5 | MIT | frontend |
| `@emotion/cache` | 11.14.0 | MIT | frontend |
| `@emotion/hash` | 0.9.2 | MIT | frontend |
| `@emotion/is-prop-valid` | 1.4.0 | MIT | frontend |
| `@emotion/memoize` | 0.9.0 | MIT | frontend |
| `@emotion/react` | 11.14.0 | MIT | frontend |
| `@emotion/serialize` | 1.3.3 | MIT | frontend |
| `@emotion/sheet` | 1.4.0 | MIT | frontend |
| `@emotion/styled` | 11.14.1 | MIT | frontend |
| `@emotion/unitless` | 0.10.0 | MIT | frontend |
| `@emotion/use-insertion-effect-with-fallbacks` | 1.2.0 | MIT | frontend |
| `@emotion/utils` | 1.4.2 | MIT | frontend |
| `@emotion/weak-memoize` | 0.4.0 | MIT | frontend |
| `@esbuild/aix-ppc64` | 0.28.2 | MIT | database |
| `@esbuild/android-arm` | 0.28.2 | MIT | database |
| `@esbuild/android-arm64` | 0.28.2 | MIT | database |
| `@esbuild/android-x64` | 0.28.2 | MIT | database |
| `@esbuild/darwin-arm64` | 0.28.2 | MIT | database |
| `@esbuild/darwin-x64` | 0.28.2 | MIT | database |
| `@esbuild/freebsd-arm64` | 0.28.2 | MIT | database |
| `@esbuild/freebsd-x64` | 0.28.2 | MIT | database |
| `@esbuild/linux-arm` | 0.28.2 | MIT | database |
| `@esbuild/linux-arm64` | 0.28.2 | MIT | database |
| `@esbuild/linux-ia32` | 0.28.2 | MIT | database |
| `@esbuild/linux-loong64` | 0.28.2 | MIT | database |
| `@esbuild/linux-mips64el` | 0.28.2 | MIT | database |
| `@esbuild/linux-ppc64` | 0.28.2 | MIT | database |
| `@esbuild/linux-riscv64` | 0.28.2 | MIT | database |
| `@esbuild/linux-s390x` | 0.28.2 | MIT | database |
| `@esbuild/linux-x64` | 0.28.2 | MIT | database |
| `@esbuild/netbsd-arm64` | 0.28.2 | MIT | database |
| `@esbuild/netbsd-x64` | 0.28.2 | MIT | database |
| `@esbuild/openbsd-arm64` | 0.28.2 | MIT | database |
| `@esbuild/openbsd-x64` | 0.28.2 | MIT | database |
| `@esbuild/openharmony-arm64` | 0.28.2 | MIT | database |
| `@esbuild/sunos-x64` | 0.28.2 | MIT | database |
| `@esbuild/win32-arm64` | 0.28.2 | MIT | database |
| `@esbuild/win32-ia32` | 0.28.2 | MIT | database |
| `@esbuild/win32-x64` | 0.28.2 | MIT | database |
| `@floating-ui/core` | 1.8.0 | MIT | frontend |
| `@floating-ui/dom` | 1.8.0 | MIT | frontend |
| `@floating-ui/utils` | 0.2.12 | MIT | frontend |
| `@jridgewell/gen-mapping` | 0.3.13 | MIT | frontend |
| `@jridgewell/resolve-uri` | 3.1.2 | MIT | frontend |
| `@jridgewell/sourcemap-codec` | 1.6.0 | MIT | frontend |
| `@jridgewell/trace-mapping` | 0.3.31 | MIT | frontend |
| `@mui/core-downloads-tracker` | 7.3.11 | MIT | frontend |
| `@mui/icons-material` | 7.3.11 | MIT | frontend |
| `@mui/material` | 7.3.11 | MIT | frontend |
| `@mui/private-theming` | 7.3.11 | MIT | frontend |
| `@mui/styled-engine` | 7.3.10 | MIT | frontend |
| `@mui/system` | 7.3.11 | MIT | frontend |
| `@mui/types` | 7.4.12 | MIT | frontend |
| `@mui/utils` | 7.3.11 | MIT | frontend |
| `@pie-element/match` | 13.0.7 | MIT (portions ISC) | frontend |
| `@pie-element/placement-ordering` | 15.0.7 | MIT (portions ISC) | frontend |
| `@pie-element/shared-configure-events` | 0.1.2 | MIT | frontend |
| `@pie-element/shared-controller-utils` | 0.1.4 | MIT | frontend |
| `@pie-element/shared-feedback` | 0.1.3 | MIT | frontend |
| `@pie-element/shared-i18n` | 0.1.2 | MIT | frontend |
| `@pie-element/shared-lodash` | 0.1.3 | MIT | frontend |
| `@pie-element/shared-math-rendering-mathjax` | 0.1.8 | MIT | frontend |
| `@pie-element/shared-player-events` | 0.2.1 | MIT | frontend |
| `@pie-element/shared-types` | 0.2.3 | MIT | frontend |
| `@pie-element/shared-utils` | 0.1.6 | MIT | frontend |
| `@pie-framework/mathml-to-latex` | 1.4.4 | MIT | frontend |
| `@pie-framework/mathquill` | 1.2.1-beta.1 | MPL-2.0 | frontend |
| `@pie-framework/pie-fixed-player-static` | 1.0.0-963a099.1 | MIT | frontend |
| `@pie-lib/config-ui` | 14.0.7 | MIT (portions ISC) | frontend |
| `@pie-lib/correct-answer-toggle` | 5.0.7 | MIT (portions ISC) | frontend |
| `@pie-lib/drag` | 5.0.7 | MIT (portions ISC) | frontend |
| `@pie-lib/editable-html-tip-tap` | 3.1.2 | MIT (portions ISC) | frontend |
| `@pie-lib/icons` | 5.0.2 | MIT (portions ISC) | frontend |
| `@pie-lib/math-input` | 9.0.7 | MIT (portions ISC) | frontend |
| `@pie-lib/math-toolbar` | 4.0.7 | MIT (portions ISC) | frontend |
| `@pie-lib/render-ui` | 8.0.7 | MIT (portions ISC) | frontend |
| `@pie-lib/translator` | 5.0.2 | MIT (portions ISC) | frontend |
| `@pie-players/pie-context` | 1.0.0-beta.3 | MIT | frontend |
| `@popperjs/core` | 2.11.8 | MIT | frontend |
| `@prisma/client` | 5.22.0 | Apache-2.0 | backend, database |
| `@prisma/debug` | 5.22.0 | Apache-2.0 | backend, database |
| `@prisma/engines` | 5.22.0 | Apache-2.0 | backend, database |
| `@prisma/engines-version` | 5.22.0-44.605197351a3c8bdd595af2d2a9bc3025bca48ea2 | Apache-2.0 | backend, database |
| `@prisma/fetch-engine` | 5.22.0 | Apache-2.0 | backend, database |
| `@prisma/get-platform` | 5.22.0 | Apache-2.0 | backend, database |
| `@remix-run/router` | 1.23.4 | MIT | frontend |
| `@tiptap/core` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-blockquote` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-bold` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-bubble-menu` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-bullet-list` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-character-count` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-code` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-code-block` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-color` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-document` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-dropcursor` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-floating-menu` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-gapcursor` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-hard-break` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-heading` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-horizontal-rule` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-italic` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-link` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-list` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-list-item` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-list-keymap` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-ordered-list` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-paragraph` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-placeholder` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-strike` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-subscript` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-superscript` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-table` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-table-cell` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-table-header` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-table-row` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-text` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-text-align` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-text-style` | 3.32.0 | MIT | frontend |
| `@tiptap/extension-underline` | 3.32.0 | MIT | frontend |
| `@tiptap/extensions` | 3.32.0 | MIT | frontend |
| `@tiptap/pm` | 3.32.0 | MIT | frontend |
| `@tiptap/react` | 3.32.0 | MIT | frontend |
| `@tiptap/starter-kit` | 3.32.0 | MIT | frontend |
| `@types/parse-json` | 4.0.2 | MIT | frontend |
| `@types/prop-types` | 15.7.15 | MIT | frontend |
| `@types/react` | 18.3.31 | MIT | frontend |
| `@types/react-dom` | 18.3.7 | MIT | frontend |
| `@types/react-transition-group` | 4.4.12 | MIT | frontend |
| `@types/trusted-types` | 2.0.7 | MIT | frontend |
| `@types/use-sync-external-store` | 0.0.6 | MIT | frontend |
| `@xmldom/xmldom` | 0.8.15 | MIT | frontend |
| `accepts` | 1.3.8 | MIT | backend |
| `agent-base` | 7.1.4 | MIT | backend |
| `array-flatten` | 1.1.1 | MIT | backend |
| `assert` | 2.1.0 | MIT | frontend |
| `available-typed-arrays` | 1.0.7 | MIT | frontend |
| `babel-plugin-macros` | 3.1.0 | MIT | frontend |
| `base64-js` | 1.5.1 | MIT | backend |
| `bignumber.js` | 9.3.1 | MIT | backend |
| `body-parser` | 1.20.9 | MIT | backend |
| `buffer-equal-constant-time` | 1.0.1 | BSD-3-Clause | backend |
| `bytes` | 3.1.2 | MIT | backend |
| `call-bind` | 1.0.9 | MIT | frontend |
| `call-bind-apply-helpers` | 1.0.2 | MIT | frontend, backend |
| `call-bound` | 1.0.4 | MIT | frontend, backend |
| `callsites` | 3.1.0 | MIT | frontend |
| `clsx` | 2.1.1 | MIT | frontend |
| `content-disposition` | 0.5.4 | MIT | backend |
| `content-type` | 1.0.5 | MIT | backend |
| `convert-source-map` | 1.9.0 | MIT | frontend |
| `cookie` | 0.7.2 | MIT | backend |
| `cookie-signature` | 1.0.7 | MIT | backend |
| `cors` | 2.8.6 | MIT | backend |
| `cosmiconfig` | 7.1.0 | MIT | frontend |
| `csstype` | 3.2.3 | MIT | frontend |
| `debug` | 2.6.9 | MIT | backend |
| `debug` | 4.4.3 | MIT | frontend, backend |
| `decimal.js` | 10.6.0 | MIT | frontend |
| `define-data-property` | 1.1.4 | MIT | frontend |
| `define-properties` | 1.2.1 | MIT | frontend |
| `depd` | 2.0.0 | MIT | backend |
| `destroy` | 1.2.0 | MIT | backend |
| `dom-helpers` | 5.2.1 | MIT | frontend |
| `dompurify` | 3.4.17 | (MPL-2.0 OR Apache-2.0) | frontend |
| `dunder-proto` | 1.0.1 | MIT | frontend, backend |
| `ecdsa-sig-formatter` | 1.0.11 | Apache-2.0 | backend |
| `ee-first` | 1.1.1 | MIT | backend |
| `encodeurl` | 2.0.0 | MIT | backend |
| `error-ex` | 1.3.4 | MIT | frontend |
| `es-define-property` | 1.0.1 | MIT | frontend, backend |
| `es-errors` | 1.3.0 | MIT | frontend, backend |
| `es-object-atoms` | 1.1.2 | MIT | frontend, backend |
| `esbuild` | 0.28.2 | MIT | database |
| `escape-html` | 1.0.3 | MIT | backend |
| `escape-string-regexp` | 4.0.0 | MIT | frontend |
| `etag` | 1.8.1 | MIT | backend |
| `express` | 4.22.3 | MIT | backend |
| `express-rate-limit` | 8.7.0 | MIT | backend |
| `extend` | 3.0.2 | MIT | backend |
| `fast-equals` | 5.4.5 | MIT | frontend |
| `finalhandler` | 1.3.2 | MIT | backend |
| `find-root` | 1.1.0 | MIT | frontend |
| `for-each` | 0.3.5 | MIT | frontend |
| `forwarded` | 0.2.0 | MIT | backend |
| `fresh` | 0.5.2 | MIT | backend |
| `fsevents` | 2.3.3 | MIT | database |
| `function-bind` | 1.1.2 | MIT | frontend, backend |
| `gaxios` | 6.7.1 | Apache-2.0 | backend |
| `gcp-metadata` | 6.1.1 | Apache-2.0 | backend |
| `generator-function` | 2.0.1 | MIT | frontend |
| `get-intrinsic` | 1.3.0 | MIT | frontend, backend |
| `get-node-dimensions` | 1.2.1 | MIT | frontend |
| `get-proto` | 1.0.1 | MIT | frontend, backend |
| `google-auth-library` | 9.15.1 | Apache-2.0 | backend |
| `google-logging-utils` | 0.0.2 | Apache-2.0 | backend |
| `gopd` | 1.2.0 | MIT | frontend, backend |
| `gtoken` | 7.1.0 | MIT | backend |
| `has-property-descriptors` | 1.0.2 | MIT | frontend |
| `has-symbols` | 1.1.0 | MIT | frontend, backend |
| `has-tostringtag` | 1.0.2 | MIT | frontend |
| `hasown` | 2.0.4 | MIT | frontend, backend |
| `helmet` | 8.3.0 | MIT | backend |
| `hoist-non-react-statics` | 3.3.2 | BSD-3-Clause | frontend |
| `http-errors` | 2.0.1 | MIT | backend |
| `https-proxy-agent` | 7.0.6 | MIT | backend |
| `i18next` | 26.5.11 | MIT | frontend |
| `iconv-lite` | 0.4.24 | MIT | backend |
| `immutable` | 5.1.9 | MIT | frontend |
| `import-fresh` | 3.3.1 | MIT | frontend |
| `inherits` | 2.0.4 | ISC | frontend, backend |
| `ip-address` | 10.7.5 | MIT | backend |
| `ipaddr.js` | 1.9.1 | MIT | backend |
| `is-arguments` | 1.2.0 | MIT | frontend |
| `is-arrayish` | 0.2.1 | MIT | frontend |
| `is-callable` | 1.2.7 | MIT | frontend |
| `is-core-module` | 2.17.0 | MIT | frontend |
| `is-generator-function` | 1.1.2 | MIT | frontend |
| `is-nan` | 1.3.2 | MIT | frontend |
| `is-regex` | 1.2.1 | MIT | frontend |
| `is-stream` | 2.0.1 | MIT | backend |
| `is-typed-array` | 1.1.15 | MIT | frontend |
| `js-combinatorics` | 2.1.4 | MIT | frontend |
| `js-tokens` | 4.0.0 | MIT | frontend |
| `jsesc` | 3.1.0 | MIT | frontend |
| `json-bigint` | 1.0.0 | MIT | backend |
| `json-parse-even-better-errors` | 2.3.1 | MIT | frontend |
| `jsonwebtoken` | 9.0.3 | MIT | backend |
| `jwa` | 2.0.1 | MIT | backend |
| `jws` | 4.0.1 | MIT | backend |
| `keycode` | 2.2.1 | MIT | frontend |
| `lines-and-columns` | 1.2.4 | MIT | frontend |
| `linkifyjs` | 4.4.0 | MIT | frontend |
| `lodash.includes` | 4.3.0 | MIT | backend |
| `lodash.isboolean` | 3.0.3 | MIT | backend |
| `lodash.isinteger` | 4.0.4 | MIT | backend |
| `lodash.isnumber` | 3.0.3 | MIT | backend |
| `lodash.isplainobject` | 4.0.6 | MIT | backend |
| `lodash.isstring` | 4.0.1 | MIT | backend |
| `lodash.once` | 4.1.1 | MIT | backend |
| `loose-envify` | 1.4.0 | MIT | frontend |
| `math-intrinsics` | 1.1.0 | MIT | frontend, backend |
| `media-typer` | 0.3.0 | MIT | backend |
| `merge-descriptors` | 1.0.3 | MIT | backend |
| `methods` | 1.1.2 | MIT | backend |
| `mime` | 1.6.0 | MIT | backend |
| `mime-db` | 1.52.0 | MIT | backend |
| `mime-types` | 2.1.35 | MIT | backend |
| `ms` | 2.0.0 | MIT | backend |
| `ms` | 2.1.3 | MIT | frontend, backend |
| `negotiator` | 0.6.3 | MIT | backend |
| `nested-property` | 4.0.0 | MIT | frontend |
| `node-fetch` | 2.7.0 | MIT | backend |
| `object-assign` | 4.1.1 | MIT | frontend, backend |
| `object-inspect` | 1.13.4 | MIT | backend |
| `object-is` | 1.1.6 | MIT | frontend |
| `object-keys` | 1.1.1 | MIT | frontend |
| `object.assign` | 4.1.7 | MIT | frontend |
| `on-finished` | 2.4.1 | MIT | backend |
| `orderedmap` | 2.1.1 | MIT | frontend |
| `parent-module` | 1.0.1 | MIT | frontend |
| `parse-json` | 5.2.0 | MIT | frontend |
| `parseurl` | 1.3.3 | MIT | backend |
| `path-parse` | 1.0.7 | MIT | frontend |
| `path-to-regexp` | 0.1.13 | MIT | backend |
| `path-type` | 4.0.0 | MIT | frontend |
| `picocolors` | 1.1.1 | ISC | frontend |
| `pluralize` | 8.0.0 | MIT | frontend |
| `possible-typed-array-names` | 1.1.0 | MIT | frontend |
| `prisma` | 5.22.0 | Apache-2.0 | backend, database |
| `prop-types` | 15.8.1 | MIT | frontend |
| `prosemirror-changeset` | 2.4.4 | MIT | frontend |
| `prosemirror-commands` | 1.7.2 | MIT | frontend |
| `prosemirror-dropcursor` | 1.8.4 | MIT | frontend |
| `prosemirror-gapcursor` | 1.4.1 | MIT | frontend |
| `prosemirror-history` | 1.5.1 | MIT | frontend |
| `prosemirror-inputrules` | 1.5.1 | MIT | frontend |
| `prosemirror-keymap` | 1.2.3 | MIT | frontend |
| `prosemirror-model` | 1.25.12 | MIT | frontend |
| `prosemirror-schema-list` | 1.5.1 | MIT | frontend |
| `prosemirror-state` | 1.4.4 | MIT | frontend |
| `prosemirror-tables` | 1.8.5 | MIT | frontend |
| `prosemirror-transform` | 1.12.4 | MIT | frontend |
| `prosemirror-view` | 1.42.8 | MIT | frontend |
| `proxy-addr` | 2.0.8 | MIT | backend |
| `qs` | 6.16.2 | BSD-3-Clause | backend |
| `range-parser` | 1.2.1 | MIT | backend |
| `raw-body` | 2.5.3 | MIT | backend |
| `react` | 18.3.1 | MIT | frontend |
| `react-attr-converter` | 0.3.1 | MIT | frontend |
| `react-dom` | 18.3.1 | MIT | frontend |
| `react-is` | 16.13.1 | MIT | frontend |
| `react-is` | 19.3.1 | MIT | frontend |
| `react-measure` | 2.5.2 | MIT | frontend |
| `react-portal` | 4.3.0 | MIT | frontend |
| `react-router` | 6.30.6 | MIT | frontend |
| `react-router-dom` | 6.30.6 | MIT | frontend |
| `react-transition-group` | 4.4.5 | BSD-3-Clause | frontend |
| `resize-observer-polyfill` | 1.5.1 | MIT | frontend |
| `resolve` | 1.22.13 | MIT | frontend |
| `resolve-from` | 4.0.0 | MIT | frontend |
| `rope-sequence` | 1.3.4 | MIT | frontend |
| `safe-buffer` | 5.2.1 | MIT | backend |
| `safe-regex-test` | 1.1.0 | MIT | frontend |
| `safer-buffer` | 2.1.2 | MIT | backend |
| `scheduler` | 0.23.2 | MIT | frontend |
| `semver` | 7.8.5 | ISC | backend |
| `send` | 0.19.2 | MIT | backend |
| `serve-static` | 1.16.3 | MIT | backend |
| `set-function-length` | 1.2.2 | MIT | frontend |
| `setprototypeof` | 1.2.0 | ISC | backend |
| `side-channel` | 1.1.1 | MIT | backend |
| `side-channel-list` | 1.0.1 | MIT | backend |
| `side-channel-map` | 1.0.1 | MIT | backend |
| `side-channel-weakmap` | 1.0.2 | MIT | backend |
| `source-map` | 0.5.7 | BSD-3-Clause | frontend |
| `statuses` | 2.0.2 | MIT | backend |
| `stylis` | 4.2.0 | MIT | frontend |
| `supports-preserve-symlinks-flag` | 1.0.0 | MIT | frontend |
| `three` | 0.186.1 | MIT | frontend |
| `tippy.js` | 6.3.7 | MIT | frontend |
| `to-style` | 1.3.3 | MIT | frontend |
| `toidentifier` | 1.0.1 | MIT | backend |
| `tr46` | 0.0.3 | MIT | backend |
| `tslib` | 2.8.1 | 0BSD | frontend |
| `tsx` | 4.23.15 | MIT | database |
| `type-is` | 1.6.18 | MIT | backend |
| `typescript` | 5.9.3 | Apache-2.0 | frontend |
| `unpipe` | 1.0.0 | MIT | backend |
| `use-sync-external-store` | 1.7.0 | MIT | frontend |
| `util` | 0.12.5 | MIT | frontend |
| `utils-merge` | 1.0.1 | MIT | backend |
| `uuid` | 9.0.1 | MIT | backend |
| `vary` | 1.1.2 | MIT | backend |
| `w3c-keyname` | 2.2.8 | MIT | frontend |
| `webidl-conversions` | 3.0.1 | BSD-2-Clause | backend |
| `whatwg-url` | 5.0.0 | MIT | backend |
| `which-typed-array` | 1.1.22 | MIT | frontend |
| `yaml` | 1.10.3 | ISC | frontend |

</details>

## Development-only packages

Tools used for testing, linting, type checking and building. They are not part of the running application.

<details>
<summary>Show the full list</summary>

| Package | Version | License | Used in |
|---|---|---|---|
| `@adobe/css-tools` | 4.5.0 | MIT | frontend |
| `@ampproject/remapping` | 2.3.0 | Apache-2.0 | frontend, backend, database |
| `@asamuzakjp/css-color` | 5.1.11 | MIT | frontend |
| `@asamuzakjp/dom-selector` | 7.1.1 | MIT | frontend |
| `@asamuzakjp/generational-cache` | 1.0.1 | MIT | frontend |
| `@asamuzakjp/nwsapi` | 2.3.9 | MIT | frontend |
| `@babel/compat-data` | 7.29.7 | MIT | frontend |
| `@babel/core` | 7.29.7 | MIT | frontend |
| `@babel/helper-compilation-targets` | 7.29.7 | MIT | frontend |
| `@babel/helper-module-transforms` | 7.29.7 | MIT | frontend |
| `@babel/helper-plugin-utils` | 7.29.7 | MIT | frontend |
| `@babel/helper-string-parser` | 7.29.7 | MIT | backend, database |
| `@babel/helper-validator-identifier` | 7.29.7 | MIT | backend, database |
| `@babel/helper-validator-option` | 7.29.7 | MIT | frontend |
| `@babel/helpers` | 7.29.7 | MIT | frontend |
| `@babel/parser` | 7.29.9 | MIT | backend, database |
| `@babel/plugin-transform-react-jsx-self` | 7.29.7 | MIT | frontend |
| `@babel/plugin-transform-react-jsx-source` | 7.29.7 | MIT | frontend |
| `@babel/types` | 7.29.8 | MIT | backend, database |
| `@bcoe/v8-coverage` | 0.2.3 | MIT | frontend, backend, database |
| `@bramus/specificity` | 2.4.2 | MIT | frontend |
| `@csstools/color-helpers` | 6.1.1 | MIT-0 | frontend |
| `@csstools/css-calc` | 3.4.0 | MIT | frontend |
| `@csstools/css-color-parser` | 4.2.3 | MIT | frontend |
| `@csstools/css-parser-algorithms` | 4.0.0 | MIT | frontend |
| `@csstools/css-syntax-patches-for-csstree` | 1.1.14 | MIT-0 | frontend |
| `@csstools/css-tokenizer` | 4.0.1 | MIT | frontend |
| `@dimforge/rapier3d-compat` | 0.12.0 | Apache-2.0 | frontend |
| `@esbuild/aix-ppc64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/aix-ppc64` | 0.28.2 | MIT | backend |
| `@esbuild/android-arm` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/android-arm` | 0.28.2 | MIT | backend |
| `@esbuild/android-arm64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/android-arm64` | 0.28.2 | MIT | backend |
| `@esbuild/android-x64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/android-x64` | 0.28.2 | MIT | backend |
| `@esbuild/darwin-arm64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/darwin-arm64` | 0.28.2 | MIT | backend |
| `@esbuild/darwin-x64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/darwin-x64` | 0.28.2 | MIT | backend |
| `@esbuild/freebsd-arm64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/freebsd-arm64` | 0.28.2 | MIT | backend |
| `@esbuild/freebsd-x64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/freebsd-x64` | 0.28.2 | MIT | backend |
| `@esbuild/linux-arm` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-arm` | 0.28.2 | MIT | backend |
| `@esbuild/linux-arm64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-arm64` | 0.28.2 | MIT | backend |
| `@esbuild/linux-ia32` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-ia32` | 0.28.2 | MIT | backend |
| `@esbuild/linux-loong64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-loong64` | 0.28.2 | MIT | backend |
| `@esbuild/linux-mips64el` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-mips64el` | 0.28.2 | MIT | backend |
| `@esbuild/linux-ppc64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-ppc64` | 0.28.2 | MIT | backend |
| `@esbuild/linux-riscv64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-riscv64` | 0.28.2 | MIT | backend |
| `@esbuild/linux-s390x` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-s390x` | 0.28.2 | MIT | backend |
| `@esbuild/linux-x64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/linux-x64` | 0.28.2 | MIT | backend |
| `@esbuild/netbsd-arm64` | 0.28.2 | MIT | backend |
| `@esbuild/netbsd-x64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/netbsd-x64` | 0.28.2 | MIT | backend |
| `@esbuild/openbsd-arm64` | 0.28.2 | MIT | backend |
| `@esbuild/openbsd-x64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/openbsd-x64` | 0.28.2 | MIT | backend |
| `@esbuild/openharmony-arm64` | 0.28.2 | MIT | backend |
| `@esbuild/sunos-x64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/sunos-x64` | 0.28.2 | MIT | backend |
| `@esbuild/win32-arm64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/win32-arm64` | 0.28.2 | MIT | backend |
| `@esbuild/win32-ia32` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/win32-ia32` | 0.28.2 | MIT | backend |
| `@esbuild/win32-x64` | 0.21.5 | MIT | frontend, backend, database |
| `@esbuild/win32-x64` | 0.28.2 | MIT | backend |
| `@eslint-community/eslint-utils` | 4.10.1 | MIT | frontend, backend, database |
| `@eslint-community/regexpp` | 4.12.2 | MIT | frontend, backend, database |
| `@eslint/config-array` | 0.21.2 | Apache-2.0 | frontend, backend, database |
| `@eslint/config-helpers` | 0.4.2 | Apache-2.0 | frontend, backend, database |
| `@eslint/core` | 0.17.0 | Apache-2.0 | frontend, backend, database |
| `@eslint/eslintrc` | 3.3.7 | MIT | frontend, backend, database |
| `@eslint/js` | 9.39.5 | MIT | frontend, backend, database |
| `@eslint/object-schema` | 2.1.7 | Apache-2.0 | frontend, backend, database |
| `@eslint/plugin-kit` | 0.4.1 | Apache-2.0 | frontend, backend, database |
| `@exodus/bytes` | 1.16.0 | MIT | frontend |
| `@humanfs/core` | 0.19.2 | Apache-2.0 | frontend, backend, database |
| `@humanfs/node` | 0.16.8 | Apache-2.0 | frontend, backend, database |
| `@humanfs/types` | 0.15.0 | Apache-2.0 | frontend, backend, database |
| `@humanwhocodes/module-importer` | 1.0.1 | Apache-2.0 | frontend, backend, database |
| `@humanwhocodes/retry` | 0.4.3 | Apache-2.0 | frontend, backend, database |
| `@isaacs/cliui` | 8.0.2 | ISC | frontend, backend, database |
| `@istanbuljs/schema` | 0.1.6 | MIT | frontend, backend, database |
| `@jridgewell/gen-mapping` | 0.3.13 | MIT | backend, database |
| `@jridgewell/remapping` | 2.3.5 | MIT | frontend |
| `@jridgewell/resolve-uri` | 3.1.2 | MIT | backend, database |
| `@jridgewell/sourcemap-codec` | 1.6.0 | MIT | backend, database |
| `@jridgewell/trace-mapping` | 0.3.31 | MIT | backend, database |
| `@napi-rs/lzma-linux-x64-gnu` | 1.5.1 | MIT | frontend, backend, database |
| `@pkgjs/parseargs` | 0.11.0 | MIT | frontend, backend, database |
| `@rolldown/pluginutils` | 1.0.0-beta.27 | MIT | frontend |
| `@rollup/rollup-android-arm-eabi` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-android-arm-eabi` | 4.63.4 | MIT | backend |
| `@rollup/rollup-android-arm-eabi` | 4.64.10 | MIT | database |
| `@rollup/rollup-android-arm64` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-android-arm64` | 4.63.4 | MIT | backend |
| `@rollup/rollup-android-arm64` | 4.64.10 | MIT | database |
| `@rollup/rollup-darwin-arm64` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-darwin-arm64` | 4.63.4 | MIT | backend |
| `@rollup/rollup-darwin-arm64` | 4.64.10 | MIT | database |
| `@rollup/rollup-darwin-x64` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-darwin-x64` | 4.63.4 | MIT | backend |
| `@rollup/rollup-darwin-x64` | 4.64.10 | MIT | database |
| `@rollup/rollup-freebsd-arm64` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-freebsd-arm64` | 4.63.4 | MIT | backend |
| `@rollup/rollup-freebsd-arm64` | 4.64.10 | MIT | database |
| `@rollup/rollup-freebsd-x64` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-freebsd-x64` | 4.63.4 | MIT | backend |
| `@rollup/rollup-freebsd-x64` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-arm-gnueabihf` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-arm-gnueabihf` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-arm-gnueabihf` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-arm-musleabihf` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-arm-musleabihf` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-arm-musleabihf` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-arm64-gnu` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-arm64-gnu` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-arm64-gnu` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-arm64-musl` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-arm64-musl` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-arm64-musl` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-loong64-gnu` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-loong64-gnu` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-loong64-gnu` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-loong64-musl` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-loong64-musl` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-loong64-musl` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-ppc64-gnu` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-ppc64-gnu` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-ppc64-gnu` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-ppc64-musl` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-ppc64-musl` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-ppc64-musl` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-riscv64-gnu` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-riscv64-gnu` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-riscv64-gnu` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-riscv64-musl` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-riscv64-musl` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-riscv64-musl` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-s390x-gnu` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-s390x-gnu` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-s390x-gnu` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-x64-gnu` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-x64-gnu` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-x64-gnu` | 4.64.10 | MIT | database |
| `@rollup/rollup-linux-x64-musl` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-linux-x64-musl` | 4.63.4 | MIT | backend |
| `@rollup/rollup-linux-x64-musl` | 4.64.10 | MIT | database |
| `@rollup/rollup-openbsd-x64` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-openbsd-x64` | 4.63.4 | MIT | backend |
| `@rollup/rollup-openbsd-x64` | 4.64.10 | MIT | database |
| `@rollup/rollup-openharmony-arm64` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-openharmony-arm64` | 4.63.4 | MIT | backend |
| `@rollup/rollup-openharmony-arm64` | 4.64.10 | MIT | database |
| `@rollup/rollup-win32-arm64-msvc` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-win32-arm64-msvc` | 4.63.4 | MIT | backend |
| `@rollup/rollup-win32-arm64-msvc` | 4.64.10 | MIT | database |
| `@rollup/rollup-win32-ia32-msvc` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-win32-ia32-msvc` | 4.63.4 | MIT | backend |
| `@rollup/rollup-win32-ia32-msvc` | 4.64.10 | MIT | database |
| `@rollup/rollup-win32-x64-gnu` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-win32-x64-gnu` | 4.63.4 | MIT | backend |
| `@rollup/rollup-win32-x64-gnu` | 4.64.10 | MIT | database |
| `@rollup/rollup-win32-x64-msvc` | 4.63.1 | MIT | frontend |
| `@rollup/rollup-win32-x64-msvc` | 4.63.4 | MIT | backend |
| `@rollup/rollup-win32-x64-msvc` | 4.64.10 | MIT | database |
| `@testing-library/dom` | 10.4.2 | MIT | frontend |
| `@testing-library/jest-dom` | 7.0.1 | MIT | frontend |
| `@testing-library/react` | 16.3.3 | MIT | frontend |
| `@testing-library/user-event` | 14.6.7 | MIT | frontend |
| `@tweenjs/tween.js` | 23.1.3 | MIT | frontend |
| `@types/aria-query` | 5.0.4 | MIT | frontend |
| `@types/babel__core` | 7.20.5 | MIT | frontend |
| `@types/babel__generator` | 7.27.0 | MIT | frontend |
| `@types/babel__template` | 7.4.4 | MIT | frontend |
| `@types/babel__traverse` | 7.28.0 | MIT | frontend |
| `@types/body-parser` | 1.19.6 | MIT | backend |
| `@types/connect` | 3.4.38 | MIT | backend |
| `@types/cors` | 2.8.19 | MIT | backend |
| `@types/estree` | 1.0.9 | MIT | frontend, backend, database |
| `@types/express` | 4.17.25 | MIT | backend |
| `@types/express-serve-static-core` | 4.19.9 | MIT | backend |
| `@types/http-errors` | 2.0.5 | MIT | backend |
| `@types/json-schema` | 7.0.15 | MIT | frontend, backend, database |
| `@types/jsonwebtoken` | 9.0.10 | MIT | backend |
| `@types/mime` | 1.3.5 | MIT | backend |
| `@types/ms` | 2.1.0 | MIT | backend |
| `@types/node` | 20.19.43 | MIT | backend, database |
| `@types/qs` | 6.15.1 | MIT | backend |
| `@types/range-parser` | 1.2.7 | MIT | backend |
| `@types/send` | 0.17.6 | MIT | backend |
| `@types/send` | 1.2.1 | MIT | backend |
| `@types/serve-static` | 1.15.10 | MIT | backend |
| `@types/stats.js` | 0.17.4 | MIT | frontend |
| `@types/three` | 0.186.0 | MIT | frontend |
| `@types/webxr` | 0.5.24 | MIT | frontend |
| `@typescript-eslint/eslint-plugin` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/eslint-plugin` | 8.71.2 | MIT | database |
| `@typescript-eslint/parser` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/parser` | 8.71.2 | MIT | database |
| `@typescript-eslint/project-service` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/project-service` | 8.71.2 | MIT | database |
| `@typescript-eslint/scope-manager` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/scope-manager` | 8.71.2 | MIT | database |
| `@typescript-eslint/tsconfig-utils` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/tsconfig-utils` | 8.71.2 | MIT | database |
| `@typescript-eslint/type-utils` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/type-utils` | 8.71.2 | MIT | database |
| `@typescript-eslint/types` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/types` | 8.71.2 | MIT | database |
| `@typescript-eslint/typescript-estree` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/typescript-estree` | 8.71.2 | MIT | database |
| `@typescript-eslint/utils` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/utils` | 8.71.2 | MIT | database |
| `@typescript-eslint/visitor-keys` | 8.70.0 | MIT | frontend, backend |
| `@typescript-eslint/visitor-keys` | 8.71.2 | MIT | database |
| `@vitejs/plugin-react` | 4.7.0 | MIT | frontend |
| `@vitest/coverage-v8` | 2.1.9 | MIT | frontend, backend, database |
| `@vitest/expect` | 2.1.9 | MIT | frontend, backend, database |
| `@vitest/mocker` | 2.1.9 | MIT | frontend, backend, database |
| `@vitest/pretty-format` | 2.1.9 | MIT | frontend, backend, database |
| `@vitest/runner` | 2.1.9 | MIT | frontend, backend, database |
| `@vitest/snapshot` | 2.1.9 | MIT | frontend, backend, database |
| `@vitest/spy` | 2.1.9 | MIT | frontend, backend, database |
| `@vitest/utils` | 2.1.9 | MIT | frontend, backend, database |
| `acorn` | 8.18.0 | MIT | frontend, backend |
| `acorn` | 8.19.0 | MIT | database |
| `acorn-jsx` | 5.3.2 | MIT | frontend, backend, database |
| `ajv` | 6.15.0 | MIT | frontend, backend, database |
| `ansi-regex` | 5.0.1 | MIT | frontend, backend, database |
| `ansi-regex` | 6.3.0 | MIT | frontend, backend |
| `ansi-regex` | 6.4.0 | MIT | database |
| `ansi-styles` | 4.3.0 | MIT | frontend, backend, database |
| `ansi-styles` | 5.2.0 | MIT | frontend |
| `ansi-styles` | 6.2.3 | MIT | frontend, backend, database |
| `argparse` | 2.0.1 | Python-2.0 | frontend, backend, database |
| `aria-query` | 5.3.0 | Apache-2.0 | frontend |
| `aria-query` | 5.3.2 | Apache-2.0 | frontend |
| `array-buffer-byte-length` | 1.0.2 | MIT | frontend |
| `array-includes` | 3.2.0 | MIT | frontend |
| `array.prototype.findlast` | 1.2.5 | MIT | frontend |
| `array.prototype.flat` | 1.3.3 | MIT | frontend |
| `array.prototype.flatmap` | 1.3.3 | MIT | frontend |
| `array.prototype.tosorted` | 1.1.4 | MIT | frontend |
| `arraybuffer.prototype.slice` | 1.0.4 | MIT | frontend |
| `assertion-error` | 2.0.1 | MIT | frontend, backend, database |
| `ast-types-flow` | 0.0.8 | MIT | frontend |
| `async-function` | 1.0.0 | MIT | frontend |
| `axe-core` | 4.13.0 | MPL-2.0 | frontend |
| `axobject-query` | 4.1.0 | Apache-2.0 | frontend |
| `balanced-match` | 1.0.2 | MIT | frontend, backend, database |
| `balanced-match` | 4.0.4 | MIT | frontend, backend, database |
| `baseline-browser-mapping` | 2.11.21 | Apache-2.0 | frontend |
| `bidi-js` | 1.1.0 | MIT | frontend |
| `brace-expansion` | 1.1.18 | MIT | frontend, backend |
| `brace-expansion` | 1.1.21 | MIT | database |
| `brace-expansion` | 2.1.7 | MIT | frontend, backend, database |
| `brace-expansion` | 5.0.12 | MIT | frontend, backend, database |
| `brace-expansion` | 5.0.9 | MIT | frontend, backend |
| `browserslist` | 4.28.9 | MIT | frontend |
| `cac` | 6.7.14 | MIT | frontend, backend, database |
| `callsites` | 3.1.0 | MIT | backend, database |
| `caniuse-lite` | 1.0.30001810 | CC-BY-4.0 | frontend |
| `chai` | 5.3.3 | MIT | frontend, backend, database |
| `chalk` | 4.1.2 | MIT | frontend, backend, database |
| `check-error` | 2.1.3 | MIT | frontend, backend, database |
| `color-convert` | 2.0.1 | MIT | frontend, backend, database |
| `color-name` | 1.1.4 | MIT | frontend, backend, database |
| `concat-map` | 0.0.1 | MIT | frontend, backend, database |
| `convert-source-map` | 2.0.0 | MIT | frontend |
| `cross-spawn` | 7.0.6 | MIT | frontend, backend, database |
| `css-tree` | 3.2.1 | MIT | frontend |
| `css.escape` | 1.5.1 | MIT | frontend |
| `damerau-levenshtein` | 1.0.8 | BSD-2-Clause | frontend |
| `data-urls` | 7.0.0 | MIT | frontend |
| `data-view-buffer` | 1.0.2 | MIT | frontend |
| `data-view-byte-length` | 1.0.2 | MIT | frontend |
| `data-view-byte-offset` | 1.0.1 | MIT | frontend |
| `debug` | 4.4.3 | MIT | database |
| `deep-eql` | 5.0.2 | MIT | frontend, backend, database |
| `deep-is` | 0.1.4 | MIT | frontend, backend, database |
| `dequal` | 2.0.3 | MIT | frontend |
| `doctrine` | 2.1.0 | Apache-2.0 | frontend |
| `dom-accessibility-api` | 0.5.16 | MIT | frontend |
| `dom-accessibility-api` | 0.6.3 | MIT | frontend |
| `eastasianwidth` | 0.2.0 | MIT | frontend, backend, database |
| `electron-to-chromium` | 1.5.422 | ISC | frontend |
| `emoji-regex` | 8.0.0 | MIT | frontend, backend, database |
| `emoji-regex` | 9.2.2 | MIT | frontend, backend, database |
| `entities` | 8.1.0 | BSD-2-Clause | frontend |
| `es-abstract` | 1.24.2 | MIT | frontend |
| `es-abstract-get` | 1.0.0 | MIT | frontend |
| `es-iterator-helpers` | 1.4.0 | MIT | frontend |
| `es-module-lexer` | 1.7.0 | MIT | frontend, backend, database |
| `es-set-tostringtag` | 2.1.0 | MIT | frontend |
| `es-shim-unscopables` | 1.1.0 | MIT | frontend |
| `es-to-primitive` | 1.3.4 | MIT | frontend |
| `esbuild` | 0.21.5 | MIT | frontend, backend, database |
| `esbuild` | 0.28.2 | MIT | backend |
| `escalade` | 3.2.0 | MIT | frontend |
| `escape-string-regexp` | 4.0.0 | MIT | backend, database |
| `eslint` | 9.39.5 | MIT | frontend, backend, database |
| `eslint-config-prettier` | 9.1.2 | MIT | frontend, backend, database |
| `eslint-plugin-jsx-a11y` | 6.10.2 | MIT | frontend |
| `eslint-plugin-react` | 7.37.5 | MIT | frontend |
| `eslint-plugin-react-hooks` | 5.2.0 | MIT | frontend |
| `eslint-scope` | 8.4.0 | BSD-2-Clause | frontend, backend, database |
| `eslint-visitor-keys` | 3.4.3 | Apache-2.0 | frontend, backend, database |
| `eslint-visitor-keys` | 4.2.1 | Apache-2.0 | frontend, backend, database |
| `eslint-visitor-keys` | 5.0.1 | Apache-2.0 | frontend, backend, database |
| `espree` | 10.4.0 | BSD-2-Clause | frontend, backend, database |
| `esquery` | 1.7.0 | BSD-3-Clause | frontend, backend, database |
| `esrecurse` | 4.3.0 | BSD-2-Clause | frontend, backend, database |
| `estraverse` | 5.3.0 | BSD-2-Clause | frontend, backend, database |
| `estree-walker` | 3.0.3 | MIT | frontend, backend, database |
| `esutils` | 2.0.3 | BSD-2-Clause | frontend, backend, database |
| `expect-type` | 1.4.0 | Apache-2.0 | frontend, backend, database |
| `fast-deep-equal` | 3.1.3 | MIT | frontend, backend, database |
| `fast-json-stable-stringify` | 2.1.0 | MIT | frontend, backend, database |
| `fast-levenshtein` | 2.0.6 | MIT | frontend, backend, database |
| `fdir` | 6.5.0 | MIT | frontend, backend, database |
| `fflate` | 0.8.3 | MIT | frontend |
| `file-entry-cache` | 8.0.0 | MIT | frontend, backend, database |
| `find-up` | 5.0.0 | MIT | frontend, backend, database |
| `flat-cache` | 4.0.1 | MIT | frontend, backend, database |
| `flatted` | 3.4.4 | ISC | frontend, backend, database |
| `foreground-child` | 3.3.1 | ISC | frontend, backend, database |
| `fsevents` | 2.3.3 | MIT | frontend, backend |
| `function.prototype.name` | 1.2.0 | MIT | frontend |
| `functions-have-names` | 1.2.3 | MIT | frontend |
| `gensync` | 1.0.0-beta.2 | MIT | frontend |
| `get-symbol-description` | 1.1.0 | MIT | frontend |
| `glob` | 10.5.0 | ISC | frontend, backend, database |
| `glob-parent` | 6.0.2 | ISC | frontend, backend, database |
| `globals` | 14.0.0 | MIT | frontend, backend, database |
| `globals` | 15.15.0 | MIT | frontend, backend, database |
| `globalthis` | 1.0.4 | MIT | frontend |
| `has-bigints` | 1.1.0 | MIT | frontend |
| `has-flag` | 4.0.0 | MIT | frontend, backend, database |
| `has-proto` | 1.2.0 | MIT | frontend |
| `html-encoding-sniffer` | 6.0.0 | MIT | frontend |
| `html-escaper` | 2.0.2 | MIT | frontend, backend, database |
| `ignore` | 5.3.2 | MIT | frontend, backend, database |
| `ignore` | 7.0.12 | MIT | database |
| `ignore` | 7.0.9 | MIT | frontend, backend |
| `import-fresh` | 3.3.1 | MIT | backend, database |
| `imurmurhash` | 0.1.4 | MIT | frontend, backend, database |
| `indent-string` | 4.0.0 | MIT | frontend |
| `internal-slot` | 1.1.0 | MIT | frontend |
| `is-array-buffer` | 3.0.5 | MIT | frontend |
| `is-async-function` | 2.1.1 | MIT | frontend |
| `is-bigint` | 1.1.0 | MIT | frontend |
| `is-boolean-object` | 1.2.2 | MIT | frontend |
| `is-data-view` | 1.0.2 | MIT | frontend |
| `is-date-object` | 1.1.0 | MIT | frontend |
| `is-document.all` | 1.0.0 | MIT | frontend |
| `is-extglob` | 2.1.1 | MIT | frontend, backend, database |
| `is-finalizationregistry` | 1.1.1 | MIT | frontend |
| `is-fullwidth-code-point` | 3.0.0 | MIT | frontend, backend, database |
| `is-glob` | 4.0.3 | MIT | frontend, backend, database |
| `is-map` | 2.0.3 | MIT | frontend |
| `is-negative-zero` | 2.0.3 | MIT | frontend |
| `is-number-object` | 1.1.1 | MIT | frontend |
| `is-potential-custom-element-name` | 1.0.1 | MIT | frontend |
| `is-set` | 2.0.3 | MIT | frontend |
| `is-shared-array-buffer` | 1.0.4 | MIT | frontend |
| `is-string` | 1.1.1 | MIT | frontend |
| `is-symbol` | 1.1.1 | MIT | frontend |
| `is-weakmap` | 2.0.2 | MIT | frontend |
| `is-weakref` | 1.1.1 | MIT | frontend |
| `is-weakset` | 2.0.4 | MIT | frontend |
| `isarray` | 2.0.5 | MIT | frontend |
| `isexe` | 2.0.0 | ISC | frontend, backend, database |
| `istanbul-lib-coverage` | 3.2.2 | BSD-3-Clause | frontend, backend, database |
| `istanbul-lib-report` | 3.0.1 | BSD-3-Clause | frontend, backend, database |
| `istanbul-lib-source-maps` | 5.0.6 | BSD-3-Clause | frontend, backend, database |
| `istanbul-reports` | 3.2.0 | BSD-3-Clause | frontend, backend, database |
| `iterator.prototype` | 1.1.5 | MIT | frontend |
| `jackspeak` | 3.4.3 | BlueOak-1.0.0 | frontend, backend, database |
| `js-yaml` | 4.3.2 | MIT | frontend, backend, database |
| `jsdom` | 29.1.1 | MIT | frontend |
| `json-buffer` | 3.0.1 | MIT | frontend, backend, database |
| `json-schema-traverse` | 0.4.1 | MIT | frontend, backend, database |
| `json-stable-stringify-without-jsonify` | 1.0.1 | MIT | frontend, backend, database |
| `json5` | 2.2.3 | MIT | frontend |
| `jsx-ast-utils` | 3.3.5 | MIT | frontend |
| `keyv` | 4.5.4 | MIT | frontend, backend, database |
| `language-subtag-registry` | 0.3.23 | CC0-1.0 | frontend |
| `language-tags` | 1.0.9 | MIT | frontend |
| `levn` | 0.4.1 | MIT | frontend, backend, database |
| `locate-path` | 6.0.0 | MIT | frontend, backend, database |
| `lodash.merge` | 4.6.2 | MIT | frontend, backend, database |
| `loupe` | 3.2.1 | MIT | frontend, backend, database |
| `lru-cache` | 10.4.3 | ISC | frontend, backend, database |
| `lru-cache` | 11.5.3 | BlueOak-1.0.0 | frontend |
| `lru-cache` | 5.1.1 | ISC | frontend |
| `lz-string` | 1.5.0 | MIT | frontend |
| `magic-string` | 0.30.21 | MIT | frontend, backend, database |
| `magicast` | 0.3.5 | MIT | frontend, backend, database |
| `make-dir` | 4.0.0 | MIT | frontend, backend, database |
| `mdn-data` | 2.27.1 | CC0-1.0 | frontend |
| `meshoptimizer` | 1.1.1 | MIT | frontend |
| `min-indent` | 1.0.1 | MIT | frontend |
| `minimatch` | 10.2.6 | BlueOak-1.0.0 | frontend, backend, database |
| `minimatch` | 3.1.5 | ISC | frontend, backend, database |
| `minimatch` | 9.0.9 | ISC | frontend, backend, database |
| `minipass` | 7.1.3 | BlueOak-1.0.0 | frontend, backend, database |
| `ms` | 2.1.3 | MIT | database |
| `nanoid` | 3.3.18 | MIT | frontend |
| `nanoid` | 3.3.19 | MIT | backend |
| `nanoid` | 3.3.20 | MIT | database |
| `natural-compare` | 1.4.0 | MIT | frontend, backend, database |
| `node-exports-info` | 1.6.2 | MIT | frontend |
| `node-releases` | 2.0.54 | MIT | frontend |
| `object-inspect` | 1.13.4 | MIT | frontend |
| `object.entries` | 1.1.9 | MIT | frontend |
| `object.fromentries` | 2.0.8 | MIT | frontend |
| `object.values` | 1.2.1 | MIT | frontend |
| `optionator` | 0.9.4 | MIT | frontend, backend, database |
| `own-keys` | 1.0.2 | MIT | frontend |
| `p-limit` | 3.1.0 | MIT | frontend, backend, database |
| `p-locate` | 5.0.0 | MIT | frontend, backend, database |
| `package-json-from-dist` | 1.0.1 | BlueOak-1.0.0 | frontend, backend, database |
| `parent-module` | 1.0.1 | MIT | backend, database |
| `parse5` | 8.0.1 | MIT | frontend |
| `path-exists` | 4.0.0 | MIT | frontend, backend, database |
| `path-key` | 3.1.1 | MIT | frontend, backend, database |
| `path-scurry` | 1.11.1 | BlueOak-1.0.0 | frontend, backend, database |
| `pathe` | 1.1.2 | MIT | frontend, backend, database |
| `pathval` | 2.0.1 | MIT | frontend, backend, database |
| `picocolors` | 1.1.1 | ISC | backend, database |
| `picomatch` | 4.0.7 | MIT | frontend, backend, database |
| `postcss` | 8.5.28 | MIT | frontend, backend |
| `postcss` | 8.5.31 | MIT | database |
| `prelude-ls` | 1.2.1 | MIT | frontend, backend, database |
| `prettier` | 3.9.10 | MIT | database |
| `prettier` | 3.9.6 | MIT | frontend, backend |
| `pretty-format` | 27.5.1 | MIT | frontend |
| `punycode` | 2.3.1 | MIT | frontend, backend, database |
| `react-is` | 17.0.2 | MIT | frontend |
| `react-refresh` | 0.17.0 | MIT | frontend |
| `redent` | 3.0.0 | MIT | frontend |
| `reflect.getprototypeof` | 1.0.10 | MIT | frontend |
| `regexp.prototype.flags` | 1.5.4 | MIT | frontend |
| `require-from-string` | 2.0.2 | MIT | frontend |
| `resolve` | 2.0.0-next.7 | MIT | frontend |
| `resolve-from` | 4.0.0 | MIT | backend, database |
| `rollup` | 4.63.1 | MIT | frontend |
| `rollup` | 4.63.4 | MIT | backend |
| `rollup` | 4.64.10 | MIT | database |
| `safe-array-concat` | 1.1.4 | MIT | frontend |
| `safe-push-apply` | 1.0.0 | MIT | frontend |
| `saxes` | 6.0.0 | ISC | frontend |
| `semver` | 6.3.1 | ISC | frontend |
| `semver` | 7.8.5 | ISC | frontend, database |
| `set-function-name` | 2.0.2 | MIT | frontend |
| `set-proto` | 1.0.0 | MIT | frontend |
| `shebang-command` | 2.0.0 | MIT | frontend, backend, database |
| `shebang-regex` | 3.0.0 | MIT | frontend, backend, database |
| `side-channel` | 1.1.1 | MIT | frontend |
| `side-channel-list` | 1.0.1 | MIT | frontend |
| `side-channel-map` | 1.0.1 | MIT | frontend |
| `side-channel-weakmap` | 1.0.2 | MIT | frontend |
| `siginfo` | 2.0.0 | ISC | frontend, backend, database |
| `signal-exit` | 4.1.0 | ISC | frontend, backend, database |
| `source-map-js` | 1.2.1 | BSD-3-Clause | frontend, backend |
| `source-map-js` | 1.2.2 | BSD-3-Clause | database |
| `stackback` | 0.0.2 | MIT | frontend, backend, database |
| `std-env` | 3.10.0 | MIT | frontend, backend, database |
| `stop-iteration-iterator` | 1.1.0 | MIT | frontend |
| `string-width` | 4.2.3 | MIT | frontend, backend, database |
| `string-width` | 5.1.2 | MIT | frontend, backend, database |
| `string-width-cjs` | 4.2.3 | MIT | frontend, backend, database |
| `string.prototype.includes` | 2.0.1 | MIT | frontend |
| `string.prototype.matchall` | 4.1.0 | MIT | frontend |
| `string.prototype.repeat` | 1.0.0 | MIT | frontend |
| `string.prototype.trim` | 1.2.11 | MIT | frontend |
| `string.prototype.trimend` | 1.0.10 | MIT | frontend |
| `string.prototype.trimstart` | 1.0.8 | MIT | frontend |
| `strip-ansi` | 6.0.1 | MIT | frontend, backend, database |
| `strip-ansi` | 7.2.0 | MIT | frontend, backend, database |
| `strip-ansi-cjs` | 6.0.1 | MIT | frontend, backend, database |
| `strip-indent` | 3.0.0 | MIT | frontend |
| `strip-json-comments` | 3.1.1 | MIT | frontend, backend, database |
| `supports-color` | 7.2.0 | MIT | frontend, backend, database |
| `symbol-tree` | 3.2.4 | MIT | frontend |
| `test-exclude` | 7.0.2 | ISC | frontend, backend, database |
| `tinybench` | 2.9.0 | MIT | frontend, backend, database |
| `tinyexec` | 0.3.2 | MIT | frontend, backend, database |
| `tinyglobby` | 0.2.17 | MIT | frontend, backend, database |
| `tinypool` | 1.1.1 | MIT | frontend, backend, database |
| `tinyrainbow` | 1.2.0 | MIT | frontend, backend, database |
| `tinyspy` | 3.0.2 | MIT | frontend, backend, database |
| `tldts` | 7.4.14 | MIT | frontend |
| `tldts-core` | 7.4.14 | MIT | frontend |
| `tough-cookie` | 6.0.2 | BSD-3-Clause | frontend |
| `tr46` | 6.0.0 | MIT | frontend |
| `ts-api-utils` | 2.5.0 | MIT | frontend, backend, database |
| `tsx` | 4.23.13 | MIT | backend |
| `type-check` | 0.4.0 | MIT | frontend, backend, database |
| `typed-array-buffer` | 1.0.3 | MIT | frontend |
| `typed-array-byte-length` | 1.0.3 | MIT | frontend |
| `typed-array-byte-offset` | 1.0.4 | MIT | frontend |
| `typed-array-length` | 1.0.8 | MIT | frontend |
| `typescript` | 5.9.3 | Apache-2.0 | backend, database |
| `typescript-eslint` | 8.70.0 | MIT | frontend, backend |
| `typescript-eslint` | 8.71.2 | MIT | database |
| `unbox-primitive` | 1.1.0 | MIT | frontend |
| `undici` | 7.29.1 | MIT | frontend |
| `undici-types` | 6.21.0 | MIT | backend, database |
| `undici-types` | 8.3.0 | MIT | frontend |
| `update-browserslist-db` | 1.3.2 | MIT | frontend |
| `uri-js` | 4.4.1 | BSD-2-Clause | frontend, backend, database |
| `vite` | 5.4.21 | MIT | frontend, backend, database |
| `vite-node` | 2.1.9 | MIT | frontend, backend, database |
| `vitest` | 2.1.9 | MIT | frontend, backend, database |
| `w3c-xmlserializer` | 5.0.0 | MIT | frontend |
| `webidl-conversions` | 8.0.1 | BSD-2-Clause | frontend |
| `whatwg-mimetype` | 5.0.0 | MIT | frontend |
| `whatwg-url` | 16.0.1 | MIT | frontend |
| `which` | 2.0.2 | ISC | frontend, backend, database |
| `which-boxed-primitive` | 1.1.1 | MIT | frontend |
| `which-builtin-type` | 1.2.1 | MIT | frontend |
| `which-collection` | 1.0.2 | MIT | frontend |
| `why-is-node-running` | 2.3.0 | MIT | frontend, backend, database |
| `word-wrap` | 1.2.5 | MIT | frontend, backend, database |
| `wrap-ansi` | 8.1.0 | MIT | frontend, backend, database |
| `wrap-ansi-cjs` | 7.0.0 | MIT | frontend, backend, database |
| `xml-name-validator` | 5.0.0 | Apache-2.0 | frontend |
| `xmlchars` | 2.2.0 | MIT | frontend |
| `yallist` | 3.1.1 | ISC | frontend |
| `yocto-queue` | 0.1.0 | MIT | frontend, backend, database |

</details>

