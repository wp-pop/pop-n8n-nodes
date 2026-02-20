/**
 * Invoice Payload Builder
 *
 * Assembles the deeply nested POP API request body from the structured
 * form parameters collected by n8n's UI. This is the core transformation
 * layer between n8n's flat parameter model and the POP API's nested JSON schema.
 *
 * The builder handles two variants:
 * - 'sdi': Italian SdI (Sistema di Interscambio) via create-xml endpoint
 * - 'peppol': European Peppol network via create-ubl endpoint
 *
 * Key differences between variants:
 * - Peppol includes extra metadata fields (parent_id, order_provider, etc.)
 * - Peppol includes top-level site/plugin metadata before the data object
 * - Tax regime defaults to 'RF01' for SdI, empty string for Peppol
 * - SDI type comes from a required top-level field for SdI, from additional options for Peppol
 *
 * The output matches the schemas in createXmlPayload.txt and createUblPayload.txt.
 */

/** Discriminator for which API endpoint variant to build the payload for */
export type InvoiceVariant = 'sdi' | 'peppol';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Loose record type used throughout to avoid strict typing on deeply nested API payloads */
type AnyRecord = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface InvoiceFormParams {
	// Required top-level fields
	licenseKey: string;
	invoiceId: number;
	filename: string;
	customerType: 'private' | 'business' | 'pa';
	sdiType?: string;
	invoiceNumber: string;
	invoiceDate: string;
	totalAmount: string;

	// Top-level payment method selector
	paymentMethod?: string;

	// fixedCollection groups
	transmitterData?: { transmitterValues?: AnyRecord };
	senderData?: { senderValues?: AnyRecord };
	recipientData?: { recipientValues?: AnyRecord };
	invoiceDetails?: { invoiceDetailValues?: AnyRecord };
	orderItems?: { itemValues?: AnyRecord[] };
	paymentData?: { paymentValues?: AnyRecord };
	bankDetails?: { bankValues?: AnyRecord };

	// collection
	additionalOptions?: AnyRecord;
}

/**
 * Assembles the deeply nested POP API payload from structured form parameters.
 *
 * @param params      - The form parameters extracted by the n8n router
 * @param variant     - 'sdi' for SdI invoices, 'peppol' for Peppol invoices
 * @param sendInvoice - Whether to include the integration object (Invio Fattura)
 * @returns            The complete API request body
 */
export function buildInvoicePayload(
	params: InvoiceFormParams,
	variant: InvoiceVariant,
	sendInvoice = false,
): AnyRecord {
	// Extract nested values from fixedCollection groups, defaulting to empty objects.
	// n8n fixedCollections wrap values in a named sub-object (e.g. transmitterData.transmitterValues).
	const t = params.transmitterData?.transmitterValues ?? {};  // Transmitter data
	const s = params.senderData?.senderValues ?? {};            // Sender / lender data
	const r = params.recipientData?.recipientValues ?? {};      // Recipient / client data
	const inv = params.invoiceDetails?.invoiceDetailValues ?? {};// Invoice detail metadata
	const items = params.orderItems?.itemValues ?? [];          // Line items array
	const pay = params.paymentData?.paymentValues ?? {};        // Payment terms/amount
	const bank = params.bankDetails?.bankValues ?? {};          // Bank details (MP05 only)
	const opts = params.additionalOptions ?? {};                // Advanced/optional settings

	// Parse JSON fields that may arrive as strings from n8n's collection UI.
	// Users can enter JSON arrays as strings; we need to parse them into actual arrays.
	let providentFund: unknown[] = [];
	if (opts.providentFund) {
		try {
			providentFund =
				typeof opts.providentFund === 'string'
					? JSON.parse(opts.providentFund)
					: opts.providentFund;
		} catch {
			providentFund = [];
		}
	}

	let connectedInvoiceData: unknown[] = [];
	if (opts.connectedInvoiceData) {
		try {
			connectedInvoiceData =
				typeof opts.connectedInvoiceData === 'string'
					? JSON.parse(opts.connectedInvoiceData)
					: opts.connectedInvoiceData;
		} catch {
			connectedInvoiceData = [];
		}
	}

	// Build the complete API payload. The structure matches the POP API v2 schema
	// as documented in createXmlPayload.txt (SdI) and createUblPayload.txt (Peppol).
	const payload: AnyRecord = {
		license_key: params.licenseKey,
		// Peppol includes additional top-level metadata fields before the data object.
		// These identify the originating system (e.g. WordPress/WooCommerce plugin).
		...(variant === 'peppol'
			? {
					...(opts.pluginVersion ? { plugin_version: opts.pluginVersion } : {}),
					...(opts.siteTitle ? { site_title: opts.siteTitle } : {}),
					...(opts.siteUrl ? { site_url: opts.siteUrl } : {}),
					...(opts.userAgentVersion ? { user_agent_version: opts.userAgentVersion } : {}),
					...(opts.userAgent ? { user_agent: opts.userAgent } : {}),
				}
			: {}),
		data: {
			id: params.invoiceId,
			// Peppol payloads include additional data-level metadata fields
			// (parent_id, order_provider, xml_style, view, save, save_bulk)
			...(variant === 'peppol'
				? {
						parent_id: opts.parentId || null,
						order_provider: opts.orderProvider || '',
						xml_style: '',
						view: false,
						save: false,
						save_bulk: false,
					}
				: {}),
			filename: params.filename,
			type: opts.type || 'invoice',
			version: opts.version || 'FPR12',
			// SDI type: for SdI invoices, read from the required top-level sdiType field;
			// for Peppol or fallback, check additional options
			sdi_type: params.sdiType || opts.sdiType || '',
			customer_type: params.customerType,
			nature: opts.nature || '',
			ref_normative: opts.refNormative || null,
			vies: opts.vies ?? false,
			vat_kind: opts.vatKind || null,
			transmitter_data: {
				transmitter_id: {
					country_id: t.transmitterCountryId || 'IT',
					id_code: t.transmitterIdCode || '',
				},
				progressive: t.progressive || '',
				transmitter_format: t.transmitterFormat || 'FPR12',
				sdi_code: t.sdiCode ?? '0000000',
				transmitter_contact: {
					phone: t.transmitterPhone || '',
					email: t.transmitterEmail || '',
				},
				recipient_pec: t.recipientPec || '',
			},
			transfer_lender: {
				personal_data: {
					tax_id_vat: {
						country_id: s.senderCountryId || 'IT',
						id_code: s.senderIdCode || '',
						// Tax regime: SdI defaults to RF01 (Ordinary); Peppol defaults to empty
					// because Peppol invoices may originate from non-Italian entities
					tax_regime: s.senderTaxRegime || (variant === 'sdi' ? 'RF01' : ''),
					},
					company_name: s.senderCompanyName || '',
				},
				place: {
					address: s.senderAddress || '',
					zip_code: s.senderZipCode || '',
					city: s.senderCity || '',
					province_id: s.senderProvinceId || '',
					country_id: s.senderCountry || 'IT',
				},
				rea_registration: {
					office: opts.reaOffice || '',
					number: opts.reaNumber || '',
					liquidation_status: opts.reaLiquidationStatus || '',
				},
				contact: {
					phone: s.senderPhone || '',
					email: s.senderEmail || '',
				},
			},
			transferee_client: {
				personal_data: {
					tax_id_vat: {
						country_id: r.recipientCountryId || 'IT',
						id_code: r.recipientIdCode || '',
					},
					tax_id_code: r.recipientTaxIdCode || '',
					company_name: r.recipientCompanyName || '',
					first_name: r.recipientFirstName || '',
					last_name: r.recipientLastName || '',
					email: r.recipientEmail || '',
				},
				place: {
					address: r.recipientAddress || '',
					zip_code: r.recipientZipCode || '',
					city: r.recipientCity || '',
					province_id: r.recipientProvinceId || '',
					country_id: r.recipientCountry || 'IT',
				},
			},
			invoice_body: {
				general_data: {
					doc_type: inv.docType || 'TD01',
					currency: inv.currency || 'EUR',
					date: params.invoiceDate,
					invoice_number: params.invoiceNumber,
					invoice_prefix: inv.invoicePrefix || '',
					invoice_suffix: inv.invoiceSuffix || '',
				},
				provident_fund: providentFund,
				total_document_amount: params.totalAmount,
			},
			purchase_order_data: {
				id: opts.purchaseOrderId || '',
				date: opts.purchaseOrderDate || '',
			},
			connected_invoice_data: connectedInvoiceData,
			// Map each line item from the n8n form structure to the API schema
		order_items: items.map((item: AnyRecord) => ({
				item_code: {
					type: item.itemCodeType || 'INTERNO',
					value: item.itemCodeValue || '',
				},
				item_type: item.itemType || 'product',
				gift_product: item.giftProduct || null,
				description: item.description || '',
				quantity: item.quantity || '1.00',
				unit: item.unit || 'N.',
				discount_type: item.discountType || '',
				discount_percent: item.discountPercent || '',
				discount_amount: item.discountAmount || '',
				unit_price: item.unitPrice || '',
				total_price: item.totalPrice || '',
				rate: item.rate || '0.00',
				total_tax: item.totalTax ?? 0,
			})),
			// Payment data: payment_details uses the top-level paymentMethod selector;
			// bank fields are populated only when MP05 (Bank Transfer) is selected
			payment_data: {
				terms_payment: pay.termsPayment || 'TP02',
				payment_amount: pay.paymentAmount || params.totalAmount,
				payment_details: params.paymentMethod || 'MP01',
				beneficiary: bank.beneficiary || '',
				financial_institution: bank.financialInstitution || '',
				iban: bank.iban || '',
			},
			overrides: {
				bollo_force_apply: opts.bolloForceApply ?? false,
			},
		},
	};

	// When "Invio Fattura" is set to Yes, add the integration object that tells
	// the POP API to actually submit the invoice to SdI or Peppol
	if (sendInvoice) {
		payload.integration = {
			use: variant === 'peppol' ? 'peppol-via-pop' : 'sdi-via-pop',
			action: 'create',
		};
	}

	return payload;
}
