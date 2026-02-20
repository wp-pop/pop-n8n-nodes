/**
 * Invoice Form Fields — shared field definitions for create operations
 *
 * This module provides a factory function that generates all the n8n
 * UI properties (form fields) needed by both the SdI and Peppol
 * create-invoice operations.
 *
 * Using a factory function allows the fields to be parameterized by
 * operation name, enabling conditional differences between SdI and Peppol:
 * - Customer type options (Peppol: Company/Freelance only; SdI: +Private)
 * - SDI Type field (SdI only — Peppol doesn't use codice destinatario)
 * - SDI Code in transmitter data (SdI only)
 *
 * Field sections:
 * A. Required top-level fields (license key, invoice ID, filename, etc.)
 * B. Transmitter Data (who sends the invoice to SdI/Peppol)
 * C. Sender / Lender (the invoicing entity)
 * D. Recipient / Client (who receives the invoice)
 * E. Invoice Details (document type, currency, prefix/suffix)
 * F. Order Items (line items with prices, quantities, VAT)
 * G. Payment Data (method, terms, bank details for MP05)
 * H. Additional Options (advanced/optional fields)
 */
import type { INodeProperties } from 'n8n-workflow';

/** The two invoice creation operations that share these form fields */
type InvoiceOperation = 'createSdiInvoiceXml' | 'createPeppolInvoiceUbl';

/**
 * Factory that returns the full set of form-mode INodeProperties
 * for a given invoice operation.
 *
 * @param operation - Which create operation these fields belong to.
 *   Controls displayOptions and conditional field inclusion.
 * @returns Array of INodeProperties to spread into the operation's properties
 */
export function makeInvoiceFormFields(operation: InvoiceOperation): INodeProperties[] {
	const showForm = {
		show: {
			resource: ['invoices'] as string[],
			operation: [operation] as string[],
			inputMode: ['form'] as string[],
		},
	};

	return [
		// ── A. Required top‑level fields ────────────────────────────
		{
			displayName: 'License Key',
			name: 'licenseKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			displayOptions: showForm,
			description: 'POP license key included in the request payload',
		},
		{
			displayName: 'Invoice / Order ID',
			name: 'invoiceId',
			type: 'number',
			required: true,
			default: 0,
			displayOptions: showForm,
			description: 'Numeric ID of the invoice or order',
		},
		{
			displayName: 'Filename',
			name: 'filename',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'IT99900088876_00009',
			displayOptions: showForm,
			description: 'FatturaPA / Peppol filename (e.g. IT99900088876_00009)',
		},
		// eslint-disable-next-line n8n-nodes-base/node-param-default-missing
		{
			displayName: 'Customer Type',
			name: 'customerType',
			type: 'options',
			required: true,
			default: operation === 'createPeppolInvoiceUbl' ? 'company' : 'private',
			options:
				operation === 'createPeppolInvoiceUbl'
					? [
							{ name: 'Company', value: 'company' },
							{ name: 'Freelance', value: 'freelance' },
						]
					: [
							{ name: 'Private', value: 'private' },
							{ name: 'Company', value: 'company' },
							{ name: 'Freelance', value: 'freelance' },
						],
			displayOptions: showForm,
			description: 'Type of the recipient customer',
		},
		...(operation === 'createSdiInvoiceXml'
			? [
					{
						displayName: 'SDI Type (Codice Destinatario)',
						name: 'sdiType',
						type: 'string' as const,
						required: true,
						default: '',
						placeholder: 'ABC1234',
						displayOptions: {
							show: {
								resource: ['invoices'],
								operation: [operation],
								inputMode: ['form'],
							},
						},
						description:
							'SdI destination code. For private customers without a 7-char code, the API defaults to 0000000. For foreign clients (country != IT) the API forces XXXXXXX.',
					},
				]
			: []),
		{
			displayName: 'Invoice Number',
			name: 'invoiceNumber',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'WEB9/2025',
			displayOptions: showForm,
			description: 'Full invoice number (e.g. WEB9/2025)',
		},
		{
			displayName: 'Invoice Date',
			name: 'invoiceDate',
			type: 'string',
			required: true,
			default: '',
			placeholder: '2025-01-31',
			displayOptions: showForm,
			description: 'Invoice date in YYYY-MM-DD format',
		},
		{
			displayName: 'Total Document Amount',
			name: 'totalAmount',
			type: 'string',
			required: true,
			default: '',
			placeholder: '16.38',
			displayOptions: showForm,
			description: 'Total amount of the document including taxes',
		},

		// ── B. Transmitter Data ─────────────────────────────────────
		{
			displayName: 'Transmitter Data',
			name: 'transmitterData',
			type: 'fixedCollection',
			placeholder: 'Set Transmitter Fields',
			default: {},
			displayOptions: showForm,
			description: 'Data identifying the entity that transmits the invoice to SdI / Peppol',
			options: [
				{
					displayName: 'Transmitter',
					name: 'transmitterValues',
					values: [
						{
							displayName: 'Country',
							name: 'transmitterCountryId',
							type: 'string',
							default: 'IT',
							description: 'ISO country code of the transmitter (e.g. IT)',
						},
						{
							displayName: 'Email',
							name: 'transmitterEmail',
							type: 'string',
							default: '',
							description: 'Transmitter contact email address',
						},
						{
							displayName: 'ID Code',
							name: 'transmitterIdCode',
							type: 'string',
							default: '',
							placeholder: 'IT99900088876',
							description: 'Transmitter identification code (e.g. IT	+	VAT number)',
						},
						{
							displayName: 'Phone',
							name: 'transmitterPhone',
							type: 'string',
							default: '',
							description: 'Transmitter contact phone number',
						},
						{
							displayName: 'Progressive',
							name: 'progressive',
							type: 'string',
							default: '',
							description: 'Progressive identifier for the transmission',
						},
						{
							displayName: 'Recipient PEC',
							name: 'recipientPec',
							type: 'string',
							default: '',
							description: 'PEC (certified email) of the recipient',
						},
						...(operation === 'createSdiInvoiceXml'
							? [
									{
										displayName: 'SDI Code',
										name: 'sdiCode',
										type: 'string' as const,
										default: '0000000',
										description: 'Codice destinatario SdI (7 characters)',
									},
								]
							: []),
						{
							displayName: 'Transmitter Format',
							name: 'transmitterFormat',
							type: 'options',
							options: [
								{
									name: 'FPR12 (Private)',
									value: 'FPR12',
								},
								{
									name: 'FPA12 (Public Administration)',
									value: 'FPA12',
								},
							],
							default: 'FPR12',
							description: 'FatturaPA format version',
						},
					],
				},
			],
		},

		// ── C. Sender (Transfer Lender) ─────────────────────────────
		{
			displayName: 'Sender (Lender)',
			name: 'senderData',
			type: 'fixedCollection',
			placeholder: 'Set Sender Fields',
			default: {},
			displayOptions: showForm,
			description: 'Information about the invoice sender / lender',
			options: [
				{
					displayName: 'Sender',
					name: 'senderValues',
					values: [
						{
							displayName: 'Address',
							name: 'senderAddress',
							type: 'string',
							default: '',
							placeholder: 'Via Roma, 123',
							description: 'Street address of the sender',
						},
						{
							displayName: 'City',
							name: 'senderCity',
							type: 'string',
							default: '',
							description: 'City name',
						},
						{
							displayName: 'Company Name',
							name: 'senderCompanyName',
							type: 'string',
							default: '',
							description: 'Company or business name of the sender',
						},
						{
							displayName: 'Country',
							name: 'senderCountry',
							type: 'string',
							default: 'IT',
							description: 'ISO country code of the sender address',
						},
						{
							displayName: 'Email',
							name: 'senderEmail',
							type: 'string',
							default: '',
							description: 'Contact email address',
						},
						{
							displayName: 'Phone',
							name: 'senderPhone',
							type: 'string',
							default: '',
							description: 'Contact phone number',
						},
						{
							displayName: 'Province',
							name: 'senderProvinceId',
							type: 'string',
							default: '',
							placeholder: 'CT',
							description: 'Province abbreviation (e.g. CT, MI, RM)',
						},
						{
							displayName: 'Tax Regime',
							name: 'senderTaxRegime',
							type: 'options',
							options: [
								{ name: 'RF01 - Ordinary', value: 'RF01' },
								{ name: 'RF02 - Small Taxpayers (art.1, c.96-117, L. 244/07)', value: 'RF02' },
								{ name: 'RF03 - New Productive Initiatives (art.13, L. 388/00)', value: 'RF03' },
								{
									name: 'RF04 - Agriculture and Related Activities and Fishing (artt.34 and 34-Bis, DPR 633/72)',
									value: 'RF04',
								},
								{
									name: 'RF05 - Sale of Salts and Tobacco (art.74, c.1, DPR 633/72)',
									value: 'RF05',
								},
								{ name: 'RF06 - Matchstick Trade (art.74, c.1, DPR 633/72)', value: 'RF06' },
								{ name: 'RF07 - Publishing (art.74, c.1, DPR 633/72)', value: 'RF07' },
								{
									name: 'RF08 - Management of Public Telephone Services (art.74, c.1, DPR 633/72)',
									value: 'RF08',
								},
								{
									name: 'RF09 - Resale of Public Transportation and Parking Documents (art.74, c.1, DPR 633/72)',
									value: 'RF09',
								},
								{
									name: 'RF10 - Entertainment, Games, and Other Activities (art.74, c.6, DPR 633/72)',
									value: 'RF10',
								},
								{
									name: 'RF11 - Travel and Tourism Agencies (art.74-Ter, DPR 633/72)',
									value: 'RF11',
								},
								{ name: 'RF12 - Agritourism (art.5, c.2, L. 413/91)', value: 'RF12' },
								{ name: 'RF13 - Door-to-Door Sales (art.25-Bis, c.6, DPR 600/73)', value: 'RF13' },
								{
									name: 'RF14 - Resale of Used Goods, Art Objects, Antiques, or Collectibles (art.36, DL 41/95)',
									value: 'RF14',
								},
								{ name: 'RF15 - Art Auction Sales Agencies (art.40-Bis, DL 41/95)', value: 'RF15' },
								{ name: 'RF16 - Cash VAT for P.A. (art.6, c.5, DPR 633/72)', value: 'RF16' },
								{ name: 'RF17 - Cash VAT (Art. 32-Bis, DL 83/2012)', value: 'RF17' },
								{ name: 'RF18 - Other', value: 'RF18' },
								{ name: 'RF19 - Flat-Rate Regime (art.1, c.54-89, L. 190/2014)', value: 'RF19' },
							],
							default: 'RF01',
							description: 'Italian tax regime code (Regime Fiscale)',
						},
						{
							displayName: 'VAT Country',
							name: 'senderCountryId',
							type: 'string',
							default: 'IT',
							description: 'ISO country code for VAT identification',
						},
						{
							displayName: 'VAT ID Code',
							name: 'senderIdCode',
							type: 'string',
							default: '',
							placeholder: 'IT99900088876',
							description: 'Full VAT identification code (e.g. IT	+	VAT number)',
						},
						{
							displayName: 'ZIP Code',
							name: 'senderZipCode',
							type: 'string',
							default: '',
							placeholder: '95100',
							description: 'Postal	/	ZIP code',
						},
					],
				},
			],
		},

		// ── D. Recipient (Transferee Client) ────────────────────────
		{
			displayName: 'Recipient (Client)',
			name: 'recipientData',
			type: 'fixedCollection',
			placeholder: 'Set Recipient Fields',
			default: {},
			displayOptions: showForm,
			description: 'Information about the invoice recipient / client',
			options: [
				{
					displayName: 'Recipient',
					name: 'recipientValues',
					values: [
						{
							displayName: 'Address',
							name: 'recipientAddress',
							type: 'string',
							default: '',
							placeholder: 'Via Roma 123',
							description: 'Street address of the recipient',
						},
						{
							displayName: 'City',
							name: 'recipientCity',
							type: 'string',
							default: '',
							description: 'City name',
						},
						{
							displayName: 'Company Name',
							name: 'recipientCompanyName',
							type: 'string',
							default: '',
							description: 'Company name (leave empty for individuals)',
						},
						{
							displayName: 'Country',
							name: 'recipientCountry',
							type: 'string',
							default: 'IT',
							description: 'ISO country code of the recipient address',
						},
						{
							displayName: 'Email',
							name: 'recipientEmail',
							type: 'string',
							default: '',
							description: 'Email address of the recipient',
						},
						{
							displayName: 'First Name',
							name: 'recipientFirstName',
							type: 'string',
							default: '',
							description: 'First name of the individual recipient',
						},
						{
							displayName: 'Last Name',
							name: 'recipientLastName',
							type: 'string',
							default: '',
							description: 'Last name of the individual recipient',
						},
						{
							displayName: 'Province',
							name: 'recipientProvinceId',
							type: 'string',
							default: '',
							placeholder: 'CT',
							description: 'Province abbreviation (e.g. CT, MI, RM)',
						},
						{
							displayName: 'Tax ID Code (Codice Fiscale)',
							name: 'recipientTaxIdCode',
							type: 'string',
							default: '',
							placeholder: 'PCCLFA75L04A494S',
							description: 'Italian fiscal code (Codice Fiscale) of the recipient',
						},
						{
							displayName: 'VAT Country',
							name: 'recipientCountryId',
							type: 'string',
							default: 'IT',
							description: 'ISO country code for VAT identification',
						},
						{
							displayName: 'VAT ID Code',
							name: 'recipientIdCode',
							type: 'string',
							default: '',
							description: 'VAT identification code (leave empty for private individuals)',
						},
						{
							displayName: 'ZIP Code',
							name: 'recipientZipCode',
							type: 'string',
							default: '',
							description: 'Postal	/	ZIP code',
						},
					],
				},
			],
		},

		// ── E. Invoice Details ──────────────────────────────────────
		{
			displayName: 'Invoice Details',
			name: 'invoiceDetails',
			type: 'fixedCollection',
			placeholder: 'Set Invoice Detail Fields',
			default: {},
			displayOptions: showForm,
			description: 'Additional invoice metadata (document type, currency, prefix/suffix)',
			options: [
				{
					displayName: 'Details',
					name: 'invoiceDetailValues',
					values: [
						{
							displayName: 'Document Type',
							name: 'docType',
							type: 'options',
							options: [
								{ name: 'TD01 - Invoice', value: 'TD01' },
								{ name: 'TD04 - Credit Note', value: 'TD04' },
							],
							default: 'TD01',
							description: 'Italian e-invoice document type code',
						},
						{
							displayName: 'Currency',
							name: 'currency',
							type: 'string',
							default: 'EUR',
							description: 'ISO 4217 currency code',
						},
						{
							displayName: 'Invoice Prefix',
							name: 'invoicePrefix',
							type: 'string',
							default: '',
							placeholder: 'WEB',
							description: 'Prefix portion of the invoice number',
						},
						{
							displayName: 'Invoice Suffix',
							name: 'invoiceSuffix',
							type: 'string',
							default: '',
							placeholder: '2025',
							description: 'Suffix portion of the invoice number (e.g. year)',
						},
					],
				},
			],
		},

		// ── F. Order Items ──────────────────────────────────────────
		{
			displayName: 'Order Items',
			name: 'orderItems',
			type: 'fixedCollection',
			placeholder: 'Add Item',
			default: {},
			typeOptions: { multipleValues: true },
			displayOptions: showForm,
			description: 'Line items included in the invoice',
			options: [
				{
					displayName: 'Item',
					name: 'itemValues',
					values: [
						{
							displayName: 'Description',
							name: 'description',
							type: 'string',
							default: '',
							required: true,
							description: 'Item description text',
						},
						{
							displayName: 'Discount Amount',
							name: 'discountAmount',
							type: 'string',
							default: '',
							description: 'Fixed discount amount',
						},
						{
							displayName: 'Discount Percent',
							name: 'discountPercent',
							type: 'string',
							default: '',
							description: 'Discount percentage (e.g. 10.00)',
						},
						{
							displayName: 'Discount Type',
							name: 'discountType',
							type: 'string',
							default: '',
							description: 'Discount type identifier (leave empty for no discount)',
						},
						{
							displayName: 'Gift Product',
							name: 'giftProduct',
							type: 'options',
							options: [
								{
									name: 'No',
									value: 'no',
								},
								{
									name: 'Yes',
									value: 'yes',
								},
							],
							default: 'no',
							description: 'Whether this item is a gift	/	free product',
						},
						{
							displayName: 'Item Code Type',
							name: 'itemCodeType',
							type: 'string',
							default: 'INTERNO',
							description: 'Type of item code (e.g. INTERNO, EAN)',
						},
						{
							displayName: 'Item Code Value',
							name: 'itemCodeValue',
							type: 'string',
							default: '',
							description: 'Value of the item code',
						},
						{
							displayName: 'Item Type',
							name: 'itemType',
							type: 'options',
							options: [
								{
									name: 'Product',
									value: 'product',
								},
								{
									name: 'Shipping',
									value: 'shipping',
								},
								{
									name: 'Fee',
									value: 'fee',
								},
								{
									name: 'Discount',
									value: 'discount',
								},
							],
							default: 'product',
							description: 'Category of this line item',
						},
						{
							displayName: 'Quantity',
							name: 'quantity',
							type: 'string',
							default: '1.00',
							description: 'Quantity (e.g. 1.00)',
						},
						{
							displayName: 'Total Price',
							name: 'totalPrice',
							type: 'string',
							default: '',
							description: 'Total price for this line (quantity x unit price)',
						},
						{
							displayName: 'Total Tax',
							name: 'totalTax',
							type: 'number',
							default: 0,
							description: 'Tax amount for this line item',
						},
						{
							displayName: 'Unit',
							name: 'unit',
							type: 'string',
							default: 'N.',
							description: 'Unit of measure (e.g. N., KG, LT)',
						},
						{
							displayName: 'Unit Price',
							name: 'unitPrice',
							type: 'string',
							default: '',
							description: 'Price per unit (e.g. 4.09)',
						},
						{
							displayName: 'VAT Rate',
							name: 'rate',
							type: 'string',
							default: '0.00',
							description: 'VAT rate percentage (e.g. 22.00, 10.00, 0.00)',
						},
					],
				},
			],
		},

		// ── G. Payment Data ─────────────────────────────────────────
		{
			displayName: 'Payment Method',
			name: 'paymentMethod',
			type: 'options',
			options: [
				{ name: 'MP01 - Cash', value: 'MP01' },
				{ name: 'MP02 - Check', value: 'MP02' },
				{ name: 'MP05 - Bank Transfer', value: 'MP05' },
				{ name: 'MP08 - Credit Card', value: 'MP08' },
				{ name: 'MP12 - RIBA', value: 'MP12' },
				{ name: 'MP15 - Special Account RIBA', value: 'MP15' },
				{ name: 'MP16 - Direct Debit', value: 'MP16' },
				{ name: 'MP19 - SEPA Direct Debit', value: 'MP19' },
				{ name: 'MP21 - SEPA Core Direct Debit', value: 'MP21' },
				{ name: 'MP22 - Withholding on Payments', value: 'MP22' },
				{ name: 'MP23 - PagoPA', value: 'MP23' },
			],
			default: 'MP01',
			displayOptions: showForm,
			description: 'Payment method code',
		},
		{
			displayName: 'Payment Data',
			name: 'paymentData',
			type: 'fixedCollection',
			placeholder: 'Set Payment Fields',
			default: {},
			displayOptions: showForm,
			description: 'Payment terms and amount information',
			options: [
				{
					displayName: 'Payment',
					name: 'paymentValues',
					values: [
						{
							displayName: 'Payment Amount',
							name: 'paymentAmount',
							type: 'string',
							default: '',
							description: 'Amount to be paid (typically equals the total document amount)',
						},
						{
							displayName: 'Payment Terms',
							name: 'termsPayment',
							type: 'options',
							options: [
								{ name: 'TP01 - Lump Sum', value: 'TP01' },
								{ name: 'TP02 - Installments', value: 'TP02' },
								{ name: 'TP03 - Advance', value: 'TP03' },
							],
							default: 'TP02',
							description: 'Payment terms type code',
						},
					],
				},
			],
		},
		{
			displayName: 'Bank Details',
			name: 'bankDetails',
			type: 'fixedCollection',
			placeholder: 'Set Bank Fields',
			default: {},
			required: true,
			displayOptions: {
				show: {
					resource: ['invoices'] as string[],
					operation: [operation] as string[],
					inputMode: ['form'] as string[],
					paymentMethod: ['MP05'] as string[],
				},
			},
			description: 'Bank transfer details (required for MP05 - Bank Transfer)',
			options: [
				{
					displayName: 'Bank',
					name: 'bankValues',
					values: [
						{
							displayName: 'Beneficiary',
							name: 'beneficiary',
							type: 'string',
							required: true,
							default: '',
							description: 'Name of the payment beneficiary',
						},
						{
							displayName: 'Financial Institution',
							name: 'financialInstitution',
							type: 'string',
							required: true,
							default: '',
							description: 'Name of the bank or financial institution',
						},
						{
							displayName: 'IBAN',
							name: 'iban',
							type: 'string',
							required: true,
							default: '',
							description: 'IBAN for bank transfer payments',
						},
					],
				},
			],
		},

		// ── H. Additional Options ───────────────────────────────────
		{
			displayName: 'Additional Options',
			name: 'additionalOptions',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: showForm,
			description: 'Optional and advanced invoice settings',
			options: [
				{
					displayName: 'Connected Invoice Data (JSON)',
					name: 'connectedInvoiceData',
					type: 'json',
					default: '[]',
					description: 'Connected invoice references as a JSON array',
				},
				{
					displayName: 'Document Type (String)',
					name: 'type',
					type: 'string',
					default: 'invoice',
					description: 'Document type string (e.g. invoice, credit_note)',
				},
				{
					displayName: 'Force Apply Bollo',
					name: 'bolloForceApply',
					type: 'boolean',
					default: false,
					description: 'Whether to force apply the bollo (stamp duty)',
				},
				{
					displayName: 'Nature (Natura)',
					name: 'nature',
					type: 'string',
					default: '',
					description: 'Nature code for VAT exempt operations (e.g. N1, N2, N3, N4)',
				},
				{
					displayName: 'Order Provider',
					name: 'orderProvider',
					type: 'string',
					default: '',
					description: 'Source system (e.g. woocommerce, shopify)',
				},
				{
					displayName: 'Parent ID',
					name: 'parentId',
					type: 'number',
					default: 0,
					description: 'Parent order/invoice ID (for linked documents)',
				},
				{
					displayName: 'Plugin Version',
					name: 'pluginVersion',
					type: 'string',
					default: '',
					description: 'Plugin version string (used by Peppol integrations)',
				},
				{
					displayName: 'Provident Fund (JSON)',
					name: 'providentFund',
					type: 'json',
					default: '[]',
					description: 'Provident fund entries as a JSON array',
				},
				{
					displayName: 'Purchase Order Date',
					name: 'purchaseOrderDate',
					type: 'string',
					default: '',
					placeholder: '2025-01-31',
					description: 'Date of the related purchase order (YYYY-MM-DD)',
				},
				{
					displayName: 'Purchase Order ID',
					name: 'purchaseOrderId',
					type: 'string',
					default: '',
					description: 'Reference to the related purchase order',
				},
				{
					displayName: 'REA Liquidation Status',
					name: 'reaLiquidationStatus',
					type: 'string',
					default: '',
					description: 'Liquidation status from REA registration',
				},
				{
					displayName: 'REA Number',
					name: 'reaNumber',
					type: 'string',
					default: '',
					description: 'REA registration number',
				},
				{
					displayName: 'REA Office',
					name: 'reaOffice',
					type: 'string',
					default: '',
					description: 'REA registration office (for Italian companies)',
				},
				{
					displayName: 'Reference Normative',
					name: 'refNormative',
					type: 'string',
					default: '',
					description: 'Normative reference text for VAT exempt operations',
				},
				{
					displayName: 'Site Title',
					name: 'siteTitle',
					type: 'string',
					default: '',
					description: 'Title of the originating site',
				},
				{
					displayName: 'Site URL',
					name: 'siteUrl',
					type: 'string',
					default: '',
					description: 'URL of the originating site',
				},
				{
					displayName: 'User Agent',
					name: 'userAgent',
					type: 'string',
					default: '',
					description: 'User agent identifier (e.g. wordpress)',
				},
				{
					displayName: 'User Agent Version',
					name: 'userAgentVersion',
					type: 'string',
					default: '',
					description: 'User agent version string',
				},
				{
					displayName: 'VAT Kind',
					name: 'vatKind',
					type: 'string',
					default: '',
					description: 'VAT kind identifier',
				},
				{
					displayName: 'Version',
					name: 'version',
					type: 'string',
					default: 'FPR12',
					description: 'FatturaPA version (FPR12, FPA12)',
				},
				{
					displayName: 'VIES',
					name: 'vies',
					type: 'boolean',
					default: false,
					description: 'Whether the transaction is intra-EU and VIES validated',
				},
			],
		},
	];
}
