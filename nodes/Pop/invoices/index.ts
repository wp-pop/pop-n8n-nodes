/**
 * Invoices resource — aggregates all operations
 *
 * This module serves two purposes:
 *
 * 1. Exports the combined `properties` array used by Pop.node.ts to
 *    register all UI fields. This includes the resource selector,
 *    operation selector, and every operation's own fields.
 *
 * 2. Exports the `invoices` object used by the router to look up
 *    operation modules by name for dispatch.
 *
 * To add a new operation to the invoices resource:
 * 1. Create a new file (e.g. newOperation.ts) with options, properties, and handler
 * 2. Import it here
 * 3. Add its options to the operation selector
 * 4. Spread its properties into the combined array
 * 5. Add it to the invoices dispatch object
 */
import { INodeProperties } from 'n8n-workflow';

import * as createSdiInvoiceXml from './createSdiInvoiceXml';
import * as createPeppolInvoiceUbl from './createPeppolInvoiceUbl';
import * as getInvoiceStatus from './getInvoiceStatus';
import * as getPeppolDocument from './getPeppolDocument';

/**
 * Combined properties array for the invoices resource.
 * Includes the resource/operation selectors and all operation-specific fields.
 */
export const properties: INodeProperties[] = [
	// Resource selector — currently only "Invoice" is available
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Invoice',
				value: 'invoices',
			},
		],
		default: 'invoices',
	},
	// Operation selector — shows all available operations for the selected resource
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['invoices'],
			},
		},
		options: [
			createSdiInvoiceXml.options,
			createPeppolInvoiceUbl.options,
			getInvoiceStatus.options,
			getPeppolDocument.options,
		],
		default: '',
	},
	// Spread each operation's fields — n8n uses displayOptions to show/hide them
	...createSdiInvoiceXml.properties,
	...createPeppolInvoiceUbl.properties,
	...getInvoiceStatus.properties,
	...getPeppolDocument.properties,
];

/**
 * Operation dispatch map used by the router.
 * Keys match the operation values defined in each module's options export.
 */
export const invoices = {
	createSdiInvoiceXml,
	createPeppolInvoiceUbl,
	getInvoiceStatus,
	getPeppolDocument,
};
