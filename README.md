# n8n-nodes-pop

![POP Cloud API](https://img.shields.io/badge/POP_Cloud_API-v2-ff5f5e?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-a8dadc?style=flat-square)
![n8n community](https://img.shields.io/badge/n8n-community_node-1a1a1a?style=flat-square)

> Community node for [n8n](https://n8n.io/) that integrates with the [POP Cloud API](https://popapi.io/) for automated electronic invoicing.

**POP** is an e-invoicing platform that automates the generation, delivery, and management of legally compliant electronic invoices. It supports both the **Italian SdI** (Sistema di Interscambio / FatturaPA) and the **European Peppol** network.

This node lets you create, send, and track electronic invoices directly from n8n workflows. Authenticate once with a **POP API credential** (sent as the `X-API-Key` header) or supply the license key per operation — both are supported.

---

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Operations](#operations)
- [Input Modes](#input-modes)
- [Form Fields Reference](#form-fields-reference)
- [Example Workflow](#example-workflow)
- [Example Payloads](#example-payloads)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Publishing](#publishing)
- [Resources](#resources)
- [License](#license)

---

---

## Installation

Follow the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

1. In n8n, go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `@getpopapi/n8n-nodes-pop`
4. Click **Install**

---

## Authentication

The POP Cloud API (v2) accepts the license key in **two** forms:

| Method                       | How                                                  | Status                  |
|------------------------------|------------------------------------------------------|-------------------------|
| **`X-API-Key` HTTP header**  | `X-API-Key: <your_license_key>`                      | **Preferred**           |
| **`license_key` body param** | `{ "license_key": "<your_license_key>", ... }`       | Legacy fallback         |

When both are present, the header wins. The body fallback exists so older POP API deployments continue to work without changes.

### How to provide the key in n8n

This node supports two ways of supplying the key, which can be combined:

1. **POP API credential** _(recommended)_ — In n8n, go to **Credentials → New → POP API**, paste the license key, and select that credential on the POP node. The node will send `X-API-Key: <your_license_key>` on every request automatically.
2. **Per-operation License Key field** — In **Form Fields** input mode, every invoice operation exposes a **License Key** field. When non-empty it overrides the credential and is sent both as the `X-API-Key` header **and** as `license_key` in the request body. Useful when one workflow needs to drive multiple licenses.

For **Use Incoming JSON**, **JSON**, and **Raw** input modes the credential is the simplest option — the header is injected automatically. You can still embed `license_key` in the body if you prefer; the API accepts both.

### What the node sends

| Mode                  | `X-API-Key` header                            | `license_key` in body                              |
|-----------------------|-----------------------------------------------|----------------------------------------------------|
| Form (key field set)  | The form field value (overrides credential)   | The form field value                               |
| Form (key field empty)| Credential value (if any)                     | Empty (`""`) — relies on header auth               |
| Use Incoming JSON     | Credential value (if any)                     | Whatever the upstream item provides                |
| JSON                  | Credential value (if any)                     | Whatever you put in the JSON body                  |
| Raw                   | Credential value (if any)                     | n/a (raw payload)                                  |

The **Verify SdI Document (XML)** operation auto-detects the license key from the upstream Create SdI Invoice node — that detected key is sent both as the header and in the body, taking precedence over the credential.

### Self-hosted POP API deployments

If you operate your own POP Cloud API deployment, make sure it includes the auth-header support — see `LicenseHelper::buildLicenseInfo` and `Utils::apiPermissionCallback` in pop-cloud-api, which prefer `X-API-Key` and fall back to `license_key`. Older deployments without that change still work because this node also sends `license_key` in the body whenever it has a key to send.

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
- Customer type is limited to **Company** or **Freelance** (Peppol does not support Private individuals)

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

#### Verify SdI Document (XML)

Validates an SdI XML document via the POP API document-verify endpoint. Designed to be used immediately after **Create SdI Invoice (XML)** in a workflow — it reads the XML from the incoming item, base64-encodes it, and auto-detects the license key from the upstream node.

- **Endpoint:** `POST /sdi-via-pop/document-verify`
- **Input:** Always passthrough — connects directly to the output of the **Create SdI Invoice (XML)** node
- **License key:** Auto-detected from the upstream POP node (supports both Form Fields and JSON input modes of the upstream node). No manual entry required.
- **Payload sent:** `{ license_key, skip_business_check: true, integration: { xml: "<base64-encoded XML>" } }`

---

### Resource: VAT Validation

#### Validate VAT

Validates a VAT number against the official **EU VIES** (VAT Information Exchange System) SOAP service.

- **Service:** `https://ec.europa.eu/taxation_customs/vies/services/checkVatService`
- **Supported countries:** All 27 EU member states + Northern Ireland (`XI`)
- **Retry logic:** Up to 5 attempts with exponential backoff (1s, 2s, 4s, 8s…) when the VIES service is temporarily unavailable
- **Returns:** `valid` (boolean), `name`, `address`, `requestDate`, `attempts` (number of retries), `latencyMs`

| Field          | Description                                    |
|----------------|------------------------------------------------|
| Country Code   | EU country code from dropdown (e.g. `IT`, `DE`, `EL`, `XI`) |
| VAT Number     | VAT number without the country prefix (e.g. `01234567890`) |

---

## Input Modes

All four operations support the same four input modes:

| Mode                  | Description                                                                                             |
|-----------------------|---------------------------------------------------------------------------------------------------------|
| **Use Incoming JSON** | Forwards the input item's JSON data directly to the API. Default mode, ideal for automated pipelines.  |
| **Form Fields**       | Structured form with all relevant fields. Best for manual entry or mapping from other nodes.            |
| **JSON**              | Paste or build the full request JSON payload manually.                                                  |
| **Raw (XML/Other)**   | Send a raw string body (e.g. XML). Sets `Content-Type: application/xml` unless overridden via headers.  |

---

## Form Fields Reference

The **Form Fields** input mode for `Create SdI Invoice (XML)` and `Create Peppol Invoice (UBL)` exposes the following sections. Fields marked with an asterisk (`*`) are required.

### A. Top-level Fields

| Field                     | SDI | Peppol | Description                                              |
|---------------------------|:---:|:------:|----------------------------------------------------------|
| License Key               | ✓   | ✓      | POP license key. Optional when a POP API credential is configured. When set, sent both as `X-API-Key` header and `license_key` body param. |
| Invoice / Order ID `*`    | ✓   | ✓      | Numeric ID of the invoice or order                       |
| Filename `*`              | ✓   | ✓      | FatturaPA / Peppol filename (e.g. `IT99900088876_00009`) |
| Customer Type `*`         | ✓   | ✓      | `Private` / `Company` / `Freelance` (Peppol: no Private) |
| SDI Type (Codice Destinatario) `*` | ✓ | —   | SdI destination code (7 chars). Defaults to `0000000` for private customers without a code; forced to `XXXXXXX` for foreign clients |
| Invoice Number `*`        | ✓   | ✓      | Full invoice number (e.g. `WEB9/2025`)                   |
| Invoice Date `*`          | ✓   | ✓      | Invoice date in `YYYY-MM-DD` format                      |
| Total Document Amount `*` | ✓   | ✓      | Total amount including taxes                             |

### B. Transmitter Data

| Field              | SDI | Peppol | Description                                  |
|--------------------|:---:|:------:|----------------------------------------------|
| Country            | ✓   | ✓      | ISO country code of the transmitter           |
| Email              | ✓   | ✓      | Transmitter contact email                     |
| ID Code            | ✓   | ✓      | Transmitter identification code               |
| Phone              | ✓   | ✓      | Transmitter contact phone                     |
| Progressive        | ✓   | —      | Progressive identifier for the transmission   |
| Recipient PEC      | ✓   | —      | PEC (certified email) of the recipient        |
| SDI Code           | ✓   | —      | Codice destinatario SdI (7 chars)             |
| Transmitter Format | ✓   | ✓      | `FPR12` (Private) or `FPA12` (Public Admin)   |

### C. Sender (Lender)

| Field         | SDI | Peppol | Description                                       |
|---------------|:---:|:------:|---------------------------------------------------|
| Address       | ✓   | ✓      | Street address                                    |
| City          | ✓   | ✓      | City name                                         |
| Company Name  | ✓   | ✓      | Company or business name                          |
| Country       | ✓   | ✓      | ISO country code of the sender address            |
| Email         | ✓   | ✓      | Contact email                                     |
| Phone         | ✓   | ✓      | Contact phone                                     |
| Province      | ✓   | ✓      | Province abbreviation (e.g. `CT`, `MI`)           |
| Tax Regime    | ✓   | —      | Italian tax regime code (e.g. `RF01` — Ordinary)  |
| VAT Country   | ✓   | ✓      | ISO country code for VAT identification           |
| VAT ID Code   | ✓   | ✓      | Full VAT identification code                      |
| ZIP Code      | ✓   | ✓      | Postal / ZIP code                                 |

### D. Recipient (Client)

| Field                          | SDI | Peppol | Description                                      |
|--------------------------------|:---:|:------:|--------------------------------------------------|
| Address                        | ✓   | ✓      | Street address                                   |
| City                           | ✓   | ✓      | City name                                        |
| Company Name                   | ✓   | ✓      | Company name (leave empty for individuals)        |
| Country                        | ✓   | ✓      | ISO country code of the recipient address         |
| Email                          | ✓   | ✓      | Email address                                    |
| First Name                     | ✓   | ✓      | First name (individuals)                         |
| Last Name                      | ✓   | ✓      | Last name (individuals)                          |
| Province                       | ✓   | ✓      | Province abbreviation                            |
| Tax ID Code (Codice Fiscale)   | ✓   | —      | Italian fiscal code of the recipient             |
| VAT Country                    | ✓   | ✓      | ISO country code for VAT identification          |
| VAT ID Code                    | ✓   | ✓      | VAT identification code                          |
| ZIP Code                       | ✓   | ✓      | Postal / ZIP code                                |

### E. Invoice Details

| Field           | Description                                         |
|-----------------|-----------------------------------------------------|
| Document Type   | `TD01` (Invoice) or `TD04` (Credit Note)            |
| Currency        | ISO 4217 currency code (default: `EUR`)             |
| Invoice Prefix  | Prefix portion of the invoice number (e.g. `WEB`)  |
| Invoice Suffix  | Suffix portion of the invoice number (e.g. `2025`) |

### F. Order Items

Each line item supports multiple values. Fields apply to both SDI and Peppol unless noted.

| Field            | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| Description `*`  | Item description text                                                       |
| Discount         | `No` (default) or `Yes`. When `Yes`, sets `discount_type = SC` in the payload |
| Discount Percent | Required when Discount is `Yes`. Percentage to apply (e.g. `10.00`)        |
| Gift Product     | `No` or `Yes` — whether the item is a gift / free product                  |
| Item Code Type   | Type of item code (e.g. `INTERNO`, `EAN`)                                  |
| Item Code Value  | Value of the item code                                                      |
| Item Type        | `Product`, `Shipping`, or `Fee`                                             |
| Quantity         | Quantity (e.g. `1.00`)                                                      |
| Total Tax        | Tax amount for this line item                                               |
| Unit             | Unit of measure (e.g. `N.`, `KG`, `LT`)                                    |
| Unit Price       | Price per unit (e.g. `4.09`)                                                |
| VAT Rate         | VAT rate percentage (e.g. `22.00`, `10.00`, `0.00`)                        |

> **Discount behaviour:** When **Discount** is set to `Yes`, **Discount Percent** is required. The `discount_amount` and `total_price` are **automatically calculated** by the node — they are not editable inputs:
> - `total_price = unit_price × quantity`
> - `discount_amount = total_price × discount_percent / 100`
> - `total_price` (sent to API) `= total_price − discount_amount`

### G. Payment Data

**Payment Method** — select from the dropdown (code is sent in the payload):

| Label                  | Payload value |
|------------------------|---------------|
| Bank Transfer          | `MP05`        |
| Cash                   | `MP01`        |
| Check                  | `MP02`        |
| Credit Card            | `MP08`        |
| Direct Debit           | `MP16`        |
| PagoPA                 | `MP23`        |
| RIBA                   | `MP12`        |
| SEPA Core Direct Debit | `MP21`        |
| SEPA Direct Debit      | `MP19`        |
| Special Account RIBA   | `MP15`        |
| Withholding on Payments| `MP22`        |

**Payment Data** (fixedCollection):

| Field          | Description                                                      |
|----------------|------------------------------------------------------------------|
| Payment Amount | Amount to be paid (typically equals the total document amount)   |
| Payment Terms  | `TP01` (Instalment), `TP02` (Full — default), `TP03` (Advance)  |

**Bank Details** — shown only when Payment Method is `Bank Transfer`:

| Field                 | Description                              |
|-----------------------|------------------------------------------|
| Beneficiary `*`       | Name of the payment beneficiary          |
| Financial Institution `*` | Name of the bank or institution     |
| IBAN `*`              | IBAN for bank transfer payments          |

### H. Additional Options

Optional advanced fields available in both SDI and Peppol form modes:

| Field                        | Description                                                        |
|------------------------------|--------------------------------------------------------------------|
| Connected Invoice Data (JSON)| Connected invoice references as a JSON array                       |
| Document Type (String)       | Document type string (e.g. `invoice`, `credit_note`)              |
| Purchase Order Date          | Date of the related purchase order (`YYYY-MM-DD`)                 |
| Purchase Order ID            | Reference to the related purchase order                            |
| Tax Exemption Reason         | Normative reference text for VAT exempt operations                |
| VAT Exemption Code           | Nature code for VAT exempt operations (e.g. `N1`, `N2`, `N3`, `N4`) |
| VIES                         | Whether the transaction is intra-EU and VIES validated (`true`/`false`) |

---

## Example Workflow

### E-invoice creation and verification

```
[Webhook] → [POP: Create SdI Invoice] → [POP: Verify SdI Document] → [POP: Get Invoice Status] → [Slack]
```

1. A **Webhook** node receives order data from your e-commerce platform
2. The **POP** node creates an SdI invoice using **Use Incoming JSON** mode — the webhook payload is forwarded as-is
3. A second **POP** node (Verify SdI Document) validates the generated XML — no configuration needed, it reads everything from the previous node
4. A third **POP** node checks the invoice status using the UUID from the create response
5. A **Slack** node notifies the team of the result

### VAT number validation

```
[Manual Trigger] → [POP: Validate VAT] → [IF: valid?] → [Send Invoice / Flag for review]
```

1. Trigger with a customer's country code and VAT number
2. The **POP** node (VAT Validation resource) calls the EU VIES service and returns validity, company name, and address
3. Branch on the `valid` field to decide whether to proceed with invoicing

---

## Example Payloads

### SdI Invoice (XML) — `POST /create-xml`

```json
{
  "license_key": "your_license_key",
  "data": {
    "id": 2575,
    "filename": "IT99900088876_00009",
    "type": "invoice",
    "version": "FPR12",
    "sdi_type": "",
    "customer_type": "private",
    "nature": "",
    "ref_normative": null,
    "vies": false,
    "transmitter_data": {
      "transmitter_id": { "country_id": "IT", "id_code": "IT99900088876" },
      "progressive": "5b27a73cab",
      "transmitter_format": "FPR12",
      "sdi_code": "0000000",
      "transmitter_contact": { "phone": "", "email": "" },
      "recipient_pec": ""
    },
    "transfer_lender": {
      "personal_data": {
        "tax_id_vat": { "country_id": "IT", "id_code": "IT99900088876", "tax_regime": "RF01" },
        "company_name": "TEST123"
      },
      "place": { "address": "Via Roma, 123", "zip_code": "95100", "city": "Catania", "province_id": "CT", "country_id": "IT" },
      "contact": { "phone": "", "email": "" }
    },
    "transferee_client": {
      "personal_data": {
        "tax_id_vat": { "country_id": "IT", "id_code": "" },
        "tax_id_code": "PCCLFA75L04A494S",
        "company_name": "",
        "first_name": "Alfio",
        "last_name": "Piccione"
      },
      "place": { "address": "Via Roma 123", "zip_code": "95100", "city": "Catania", "province_id": "CT", "country_id": "IT" }
    },
    "invoice_body": {
      "general_data": {
        "doc_type": "TD01",
        "currency": "EUR",
        "date": "2025-01-31",
        "invoice_number": "WEB9/2025",
        "invoice_prefix": "WEB",
        "invoice_suffix": "2025"
      },
      "total_document_amount": "16.38"
    },
    "purchase_order_data": { "id": "#2575", "date": "2025-01-31" },
    "connected_invoice_data": [],
    "order_items": [
      {
        "item_code": { "type": "INTERNO", "value": "2563" },
        "item_type": "product",
        "gift_product": "no",
        "description": "Product A",
        "quantity": "1.00",
        "unit": "N.",
        "discount_type": "",
        "discount_percent": "",
        "discount_amount": "",
        "unit_price": "4.09",
        "total_price": "4.09",
        "rate": "0.00",
        "total_tax": 0
      }
    ],
    "payment_data": {
      "terms_payment": "TP02",
      "payment_amount": "16.38",
      "payment_details": "MP02",
      "beneficiary": "",
      "financial_institution": "",
      "iban": ""
    }
  },
  "integration": {
    "use": "sdi-via-pop",
    "action": "create"
  }
}
```

### Peppol Invoice (UBL) — `POST /create-ubl`

```json
{
  "license_key": "your_license_key",
  "data": {
    "id": 2855,
    "xml_style": "",
    "view": false,
    "save": false,
    "save_bulk": false,
    "filename": "BE0123456789_0000T",
    "type": "invoice",
    "version": "FPR12",
    "sdi_type": "",
    "customer_type": "company",
    "nature": "",
    "ref_normative": null,
    "vies": false,
    "transmitter_data": {
      "transmitter_id": { "country_id": "BE", "id_code": "BE0123456789" },
      "progressive": "cea0d365b4",
      "transmitter_format": "FPR12",
      "sdi_code": "0000000",
      "transmitter_contact": { "phone": "", "email": "info@company.com" },
      "recipient_pec": ""
    },
    "transfer_lender": {
      "personal_data": {
        "tax_id_vat": { "country_id": "BE", "id_code": "BE0123456789", "tax_regime": "" },
        "company_name": "My Company SRL"
      },
      "place": { "address": "Via Roma, 123", "zip_code": "1000", "city": "Brussels", "province_id": "", "country_id": "BE" },
      "contact": { "phone": "", "email": "info@company.com" }
    },
    "transferee_client": {
      "personal_data": {
        "tax_id_vat": { "country_id": "BE", "id_code": "BE0727506532" },
        "tax_id_code": "",
        "company_name": "Client Company NV",
        "first_name": "",
        "last_name": ""
      },
      "place": { "address": "Rue du Test 12", "zip_code": "4444", "city": "Liege", "province_id": "", "country_id": "BE" }
    },
    "invoice_body": {
      "general_data": {
        "doc_type": "TD01",
        "currency": "EUR",
        "date": "2025-10-03",
        "invoice_number": "WEB097/2025",
        "invoice_prefix": "WEB",
        "invoice_suffix": "2025"
      },
      "total_document_amount": "4.80"
    },
    "purchase_order_data": { "id": "#2855", "date": "2025-10-03" },
    "connected_invoice_data": [],
    "order_items": [
      {
        "item_code": { "type": "INTERNO", "value": "2636" },
        "item_type": "product",
        "gift_product": null,
        "description": "Product B",
        "quantity": "1.00",
        "unit": "N.",
        "discount_type": "",
        "discount_percent": "",
        "discount_amount": "",
        "unit_price": "4.80",
        "total_price": "4.80",
        "rate": "0.00",
        "total_tax": 0
      }
    ],
    "payment_data": {
      "terms_payment": "TP02",
      "payment_amount": "4.80",
      "payment_details": "MP01",
      "beneficiary": "",
      "financial_institution": "",
      "iban": ""
    }
  },
  "integration": {
    "use": "peppol-via-pop",
    "action": "create"
  }
}
```

### Get Invoice Status — `POST /document-notifications`

```json
{
  "license_key": "your_license_key",
  "integration": {
    "uuid": "your-integration-uuid"
  }
}
```

### Get Peppol Document — `POST /peppol/document-get`

```json
{
  "license_key": "your_license_key",
  "integration": {
    "uuid": "your-integration-uuid",
    "zone": "BE"
  }
}
```

### Verify SdI Document — `POST /sdi-via-pop/document-verify`

> This operation has no manual payload — it is always passthrough. The node reads the XML from the incoming item (output of **Create SdI Invoice (XML)**), base64-encodes it, and auto-detects the license key from the upstream node.

The request sent to the API looks like:

```json
{
  "license_key": "<auto-detected from upstream node>",
  "skip_business_check": true,
  "integration": {
    "xml": "<base64-encoded FatturaPA XML>"
  }
}
```

### Validate VAT (VIES)

> This operation calls the EU VIES SOAP service, not the POP API.

Example response:

```json
{
  "valid": true,
  "name": "GOOGLE ITALY S.R.L.",
  "address": "VIA FEDERICO CONFALONIERI 4\n20124 MILANO MI",
  "requestDate": "2026-04-02",
  "attempts": 1,
  "latencyMs": 412
}
```

---

## Project Structure

```
n8n-nodes-pop/
├── nodes/Pop/
│   ├── Pop.node.ts                  # Node definition and metadata
│   ├── Pop.node.json                # Codex metadata (categories, aliases, docs links)
│   ├── pop.svg                      # Node icon
│   ├── router.ts                    # Per-item operation dispatcher
│   ├── types/pop.ts                 # TypeScript resource/operation type map
│   ├── utils/request.ts             # Shared HTTP helper (base URL + error wrapping)
│   ├── invoices/
│   │   ├── index.ts                 # Operation aggregator for the invoices resource
│   │   ├── invoiceFields.ts         # Form field factory (shared by SdI and Peppol)
│   │   ├── invoicePayloadBuilder.ts # Assembles API payloads from form values
│   │   ├── createSdiInvoiceXml.ts   # Operation: Create SdI Invoice
│   │   ├── createPeppolInvoiceUbl.ts# Operation: Create Peppol Invoice
│   │   ├── getInvoiceStatus.ts      # Operation: Get Invoice Status
│   │   ├── getPeppolDocument.ts     # Operation: Get Peppol Document
│   │   └── verifySdiDocument.ts     # Operation: Verify SdI Document (XML)
│   └── vies/
│       ├── index.ts                 # Operation aggregator for the vies resource
│       └── validateVat.ts           # Operation: Validate VAT (EU VIES SOAP)
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

---

## Local Development

### Prerequisites

- **Node.js v22+** (use `.nvmrc`: `nvm use`)
- **npm**

### Steps

```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript → dist/
npm run lint      # Check for linting issues
npm run lint:fix  # Auto-fix linting issues where possible
npm run dev       # Start watch mode + n8n
```

`npm run dev` (via `@n8n/node-cli`):
- Symlinks the package into `~/.n8n-node-cli/.n8n/custom/node_modules/`
- Starts `tsc --watch`, which recompiles on every file save
- Downloads and starts `n8n@latest` via `npx` (first run may take a while)
- Sets `N8N_DEV_RELOAD=true` so n8n picks up changes automatically

Open [http://localhost:5678](http://localhost:5678), search for **POP** in the node panel, and start testing. Code changes are picked up automatically — no restart needed.

### Verifying the node works

1. Create a new workflow
2. Add a **Manual Trigger** node
3. Add the **POP** node and connect it to the trigger
4. Select **Invoice** as the resource and an operation (e.g. **Create SdI Invoice (XML)**)
5. Set **Input Mode** to **JSON** and paste one of the [example payloads](#example-payloads) above
6. Click **Execute node** — you should see a successful API response or a descriptive error with the full URL, HTTP status, and response body

---

## Publishing

```bash
npm login        # Log in to your npm account
npm run release  # Builds, versions, and publishes via @n8n/node-cli
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
