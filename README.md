# n8n-nodes-pop

![POP Cloud API](https://img.shields.io/badge/POP_Cloud_API-v2-ff5f5e?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-a8dadc?style=flat-square)
![n8n community](https://img.shields.io/badge/n8n-community_node-1a1a1a?style=flat-square)

> Community node for [n8n](https://n8n.io/) that integrates with the [POP Cloud API](https://popapi.io/) for automated electronic invoicing.

**POP** is an e-invoicing platform that automates the generation, delivery, and management of legally compliant electronic invoices. It supports both the **Italian SdI** (Sistema di Interscambio / FatturaPA) and the **European Peppol** network.

This node lets you create, send, and track electronic invoices directly from n8n workflows — no code required, and **no credentials to configure**.

---

## Installation

Follow the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

1. In n8n, go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `@babinimazzari/n8n-nodes-pop`
4. Click **Install**

---

## Configuration

This node does **not** require any credentials to be set up. Instead, each operation exposes a **Base URL** input field at the top of its settings.

| Field        | Description                                                                           |
| ------------ | ------------------------------------------------------------------------------------- |
| **Base URL** | Full base URL of the POP API (e.g. `https://your-instance.popapi.io/wp-json/api/v2/`) |

The default value (`https://staging7.popapi.io/wp-json/api/v2/`) targets the POP staging environment. Replace it with your production URL when you are ready.

Because the Base URL is a regular node input, you can:

- Use a different URL per operation within the same workflow
- Set it dynamically using an expression (e.g. `={{ $env.POP_BASE_URL }}`)
- Map it from a previous node's output

> The **license key** is sent inside each request payload (via the Form Fields input mode), not in a shared credential. This lets you use different license keys per operation or workflow.

---

## Operations

### Resource: Invoice

#### Create SdI Invoice (XML)

Generates an Italian e-invoice in **FatturaPA** format and optionally submits it to the **Sistema di Interscambio**.

- **Endpoint:** `POST /create-xml`
- **Invio Fattura:** Toggle to `Yes` to include the SdI integration object and trigger submission via POP
- **Input modes:** Passthrough, Form Fields, JSON, Raw

#### Create Peppol Invoice (UBL)

Generates a **Peppol** invoice in **UBL** format and optionally submits it to the **Peppol** network.

- **Endpoint:** `POST /create-ubl`
- **Invio Fattura:** Toggle to `Yes` to include the Peppol integration object
- **Input modes:** Passthrough, Form Fields, JSON, Raw
- Customer type is limited to Company or Freelance (Peppol does not support Private individuals)

#### Get Invoice Status

Retrieves document notifications for a previously submitted SdI invoice.

- **Endpoint:** `POST /document-notifications`
- **Form payload:** `{ license_key, integration: { uuid } }`
- **Input modes:** Passthrough, Form Fields, JSON, Raw

#### Get Peppol Document

Retrieves a Peppol document by integration UUID.

- **Endpoint:** `POST /peppol/document-get`
- **Form payload:** `{ license_key, integration: { uuid, zone? } }`
- The `zone` field (e.g. `"BE"`) is required for Belgian VAT numbers; it is normalised to uppercase automatically
- **Input modes:** Passthrough, Form Fields, JSON, Raw

---

## Input Modes

All four operations support the same four input modes:

| Mode                  | Description                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| **Use Incoming JSON** | Forwards the input item's JSON data directly to the API. Default mode, ideal for automated pipelines.  |
| **Form Fields**       | Structured form with all relevant fields. Best for manual entry or mapping from other nodes.           |
| **JSON**              | Paste or build the full request JSON payload manually.                                                 |
| **Raw (XML/Other)**   | Send a raw string body (e.g. XML). Sets `Content-Type: application/xml` unless overridden via headers. |

---

## Example Workflow

```
[Webhook] → [POP: Create SdI Invoice] → [POP: Get Invoice Status] → [Slack]
```

1. A Webhook node receives order data from your e-commerce platform
2. The POP node creates an SdI invoice using **Use Incoming JSON** mode — the webhook payload is forwarded as-is
3. A second POP node checks the invoice status using the UUID from the previous response
4. A Slack node notifies the team of the result

---

## Project Structure

```
n8n-nodes-pop/
├── credentials/
│   └── PopApi.credentials.ts       # Unused — kept for reference only
├── nodes/Pop/
│   ├── Pop.node.ts                  # Node definition and metadata
│   ├── Pop.node.json                # Codex metadata (categories, aliases, docs links)
│   ├── pop.svg                      # Node icon
│   ├── router.ts                    # Per-item operation dispatcher
│   ├── types/pop.ts                 # TypeScript resource/operation type map
│   ├── utils/request.ts             # Shared HTTP helper (base URL + error wrapping)
│   └── invoices/
│       ├── index.ts                 # Operation aggregator for the invoices resource
│       ├── invoiceFields.ts         # Form field factory (shared by SdI and Peppol)
│       ├── invoicePayloadBuilder.ts # Assembles deeply nested API payloads from form values
│       ├── createSdiInvoiceXml.ts   # Operation: Create SdI Invoice
│       ├── createPeppolInvoiceUbl.ts# Operation: Create Peppol Invoice
│       ├── getInvoiceStatus.ts      # Operation: Get Invoice Status
│       └── getPeppolDocument.ts     # Operation: Get Peppol Document
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

---

## Testing Locally — Step-by-Step Guide

### Prerequisites

- **Node.js v22+** (use `.nvmrc`: `nvm use`)
- **npm**
- **n8n** installed globally (`npm install -g n8n`) **or** Docker

---

### Method 1: npm link (recommended)

This is the fastest way to test the node during development. Changes to the TypeScript source are reflected after rebuilding.

**Step 1 — Install dependencies and build**

```bash
npm install
npm run build
```

**Step 2 — Create a global npm link**

```bash
npm link
```

**Step 3 — Link the package into n8n's custom nodes directory**

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm link @babinimazzari/n8n-nodes-pop
```

**Step 4 — Start n8n**

```bash
n8n start
```

**Step 5 — Open the editor**

Navigate to [http://localhost:5678](http://localhost:5678) in your browser.

**Step 6 — Find the node**

In the node panel, search for **POP**. The node should appear under the _Transform_ category.

**After making code changes:**

```bash
# In the package directory
npm run build
# Restart n8n (stop with Ctrl+C, then run n8n start again)
```

---

### Method 2: Docker with a volume mount

Useful when you want a clean n8n environment without a global installation.

**Step 1 — Build the package**

```bash
npm install
npm run build
```

**Step 2 — Run n8n with the package directory mounted**

```bash
docker run -it --rm \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -v "$(pwd)":/home/node/.n8n/nodes/node_modules/@babinimazzari/n8n-nodes-pop \
  docker.n8n.io/n8nio/n8n
```

> On Windows (PowerShell), replace `$(pwd)` with `${PWD}`.

**Step 3 — Open the editor**

Navigate to [http://localhost:5678](http://localhost:5678).

---

### Verifying the node works

Once n8n is running with the node loaded:

1. Create a new workflow
2. Add a **Manual Trigger** node
3. Add the **POP** node and connect it to the trigger
4. Select **Invoice** as the resource and **Create SdI Invoice (XML)** as the operation
5. Set **Input Mode** to **JSON** and paste a test payload:

```json
{
	"license_key": "your_license_key",
	"data": {
		"id": 1,
		"filename": "IT99900088876_00001",
		"type": "invoice"
	}
}
```

6. Click **Execute node** — you should see either a successful API response or a descriptive error message that includes the full URL, HTTP status, and response body excerpt

---

### Linting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix where possible
```

---

### Publishing to npm

```bash
npm login           # Log in to your npm account
npm run release     # Builds, versions, and publishes via @n8n/node-cli
```

> From **May 1st, 2026**, all community nodes must be published via a GitHub Action that includes a provenance statement. See the [n8n community node publishing guide](https://docs.n8n.io/integrations/community-nodes/build-community-nodes/) for details.

---

## Resources

- [POP Cloud API Documentation (Postman)](https://documenter.getpostman.com/view/41622997/2sAYkLmGT8)
- [POP Website](https://popapi.io/)
- [n8n Community Nodes Guide](https://docs.n8n.io/integrations/community-nodes/)
- [n8n Creating Nodes](https://docs.n8n.io/integrations/creating-nodes/)

---

## License

[MIT](LICENSE.md) — Babini Mazzari S.r.l.
