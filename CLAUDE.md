## Project overview

This is an n8n community node package for integrating the **POP Cloud API (v2)** with n8n workflows.

It follows the same architecture as the Musixmatch reference repo:
- `credentials/` defines how n8n stores/authenticates to the API
- `nodes/Pop/Pop.node.ts` defines the node and delegates execution to `router.ts`
- `nodes/Pop/<resource>/` folders implement operations with a consistent pattern

## Resources and operations

### `invoices` resource
- **createSdiInvoiceXml** — `POST /create-xml` — generates an Italian FatturaPA (SdI) invoice
- **createPeppolInvoiceUbl** — `POST /create-ubl` — generates a Peppol UBL invoice
- **getInvoiceStatus** — `POST /document-notifications` — retrieves SdI notification events by UUID
- **getPeppolDocument** — `POST /peppol/document-get` — retrieves a Peppol document by UUID
- **verifySdiDocument** — `POST /sdi-via-pop/document-verify` — validates an SdI XML document (passthrough-only: reads XML from the incoming item produced by createSdiInvoiceXml, base64-encodes it, and auto-detects the license key from the upstream node's parameters)

### `vies` resource
- **validateVat** — validates a VAT number against the EU VIES SOAP service (`https://ec.europa.eu/taxation_customs/vies/services/checkVatService`). Includes retry logic (5 attempts, exponential backoff up to 30s), 28-country EU dropdown (EL for Greece, XI for Northern Ireland), and returns `valid`, `name`, `address`, `requestDate`, `attempts`, `latencyMs`.

## Authentication

The POP Cloud API v2 accepts the license key as `X-API-Key` header (preferred) or as `license_key` body param (legacy fallback). The corresponding pop-cloud-api change lives in `classes/utils.php::apiPermissionCallback` and `classes/license-helper.php::buildLicenseInfo`/`debug_log_license_issue`.

The n8n node ships an optional `popApi` credential (`credentials/PopApi.credentials.ts`, registered in `package.json` `n8n.credentials`) with a single `apiKey` field. The credential's `authenticate` is `IAuthenticateGeneric` injecting `X-API-Key`, and `popRequest` (in `nodes/Pop/utils/request.ts`) also fetches it manually so that plain `httpRequest` calls (which we use) get the header automatically.

**Resolution order per operation:**
1. Form-mode `licenseKey` field (when set) — overrides everything; sent as both `X-API-Key` header and `license_key` body.
2. `popApi` credential — when configured, `popRequest` injects `X-API-Key` if no header was set by the handler. Body has no `license_key` (only the header carries auth).
3. For `verifySdiDocument`: detected upstream-node license key takes precedence over the credential (header + body both populated).

The form License Key field is **not required** — leaving it empty makes the operation use the credential. This is intentional UX so users don't re-type their key on every operation.

### Credential test is intentionally NOT defined

`PopApi.credentials.ts` has no `test: ICredentialTestRequest`. The lint rule `@n8n/community-nodes/credential-test-required` is suppressed at the top of the file with an eslint-disable comment. **Do not re-add a `test` block.**

Why: n8n auto-runs the test request whenever the credential is saved. POP API has no dedicated validation endpoint, and reusing a real route (e.g. `document-notifications` with a dummy UUID) returns a non-2xx for invalid input even when auth is fine, which makes the credential save dialog show "Couldn't connect with these settings" for valid keys. Validity is verified at first-use time by any operation that calls the API.

## Development commands

### Building
```bash
npm run build
npm run build:watch
```

### Development
```bash
npm run dev
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Publishing

Package is published on npm as `@getpopapi/n8n-nodes-pop`.

**History:** First publish was `@babinimazzari/n8n-nodes-pop` v0.1.0 on 2026-04-22 (wrong scope). Republished under the `@getpopapi` org after the GitHub repo was renamed from `getpopapi/pop-n8n-nodes` to `getpopapi/n8n-nodes-pop`. The `@babinimazzari` package on npm is abandoned — do not push new versions there.

**Repo ↔ scope alignment:** GitHub repo is `getpopapi/n8n-nodes-pop`; npm scope is `@getpopapi`. `package.json` `homepage` and `repository.url` must point to `getpopapi/n8n-nodes-pop` — npm provenance verifies the repo URL against the workflow identity, and a mismatch fails the publish.

### Release flow (tag-driven)

```bash
npm version patch        # or minor/major — bumps package.json + creates commit + tag
git push --follow-tags
```

Pushing a `v*` tag triggers `.github/workflows/publish.yml`, which runs `npm ci → lint → build → npm publish --provenance --access public`.

### Auth — current setup (Opzione B)

- `NPM_TOKEN` repo secret on `getpopapi/n8n-nodes-pop` → Settings → Secrets → Actions
- Token is a **Granular Access Token** with scope `@getpopapi`, *Read and write*, **Bypass 2FA enabled** (required because user 2FA is "Authorization and writes")
- Token expires every 90 days — rotate before expiry

### To migrate to Opzione A (Trusted Publisher OIDC) later

1. npmjs.com → package `@getpopapi/n8n-nodes-pop` → Settings → Publishing access
2. Add trusted publisher: owner `getpopapi`, repo `n8n-nodes-pop`, workflow `publish.yml`
3. Delete the `NPM_TOKEN` secret from the GitHub repo
4. Remove the `NODE_AUTH_TOKEN` line from `publish.yml` (the `id-token: write` permission and `registry-url` stay)

### Gotchas

- **Do not re-add `prepublishOnly: n8n-node prerelease`** to `package.json`. That script from `@n8n/node-cli` is a deliberate safety guard that prints `Run \`npm run release\` to publish the package` and exits 1 — it blocks any CI-driven `npm publish`. The hook was removed on 2026-04-22.
- `npm run release` (the n8n-node CLI's own release flow) is an interactive tool and does not fit tag-driven CI. Always release via `npm version` + tag push.
- Tags must start with lowercase `v` (e.g. `v0.1.1`) to match `on.push.tags: ['v*']`.

### Installing the published node in n8n

The published package is not auto-discovered — each n8n instance must install it explicitly:

- **Self-hosted:** Settings → Community Nodes → Install → `@getpopapi/n8n-nodes-pop`
- **n8n Cloud:** requires verification via n8n's community node verification flow; unverified packages are not installable on Cloud

## Notes

- Requests use `this.helpers.httpRequest()` (plain, unauthenticated transport). The `X-API-Key` header is set explicitly by handlers (form-mode override) or auto-injected from the optional `popApi` credential by `popRequest` itself — see the [Authentication](#authentication) section.
- The **Base URL** is configured per-operation via a node input field. It defaults to `https://staging7.popapi.io/wp-json/api/v2/`. Users can override it per workflow.
- `n8n-workflow` is installed as a `devDependency` (not only a peerDependency) so TypeScript can resolve its types during the build.
- The `tsconfig.json` lib list (`es2019`, `es2020`, `es2022.error`) includes neither DOM nor Node.js types. Global Node.js APIs used in operation files must be declared inline:
  - `declare function setTimeout(callback: () => void, ms: number): number;` — in `vies/validateVat.ts`
  - `declare const Buffer: { from(data: string, encoding?: string): { toString(encoding: string): string }; };` — in `invoices/verifySdiDocument.ts`
- In `router.ts`, the operation lookup must cast to `any` — `(config[resource] as any)[operationName]` — because `operationName` is a union of all operations across all resources and TypeScript cannot index a single resource's map with it.
- The operation selector's `default` must be `''` (empty string), not a specific operation value, or the n8n lint rule `node-param-default-wrong-for-options` will fail.
- `scripts/dev.js` (custom replacement for `n8n-node dev` that pins the n8n version) must `fs.mkdirSync(path.dirname(symlinkPath), { recursive: true })` before `fs.symlinkSync`. For scoped packages, the symlink target lives under `<n8n-user-folder>/.n8n/custom/node_modules/<scope>/<name>`; without the parent-mkdir, `npm run dev` fails with `ENOENT: no such file or directory, symlink '<cwd>' -> '<...>/<scope>/<name>'` the first time you change npm scope. After a scope rename also delete the stale `<old-scope>/` folder under that path so n8n doesn't load the same node twice under two names.
