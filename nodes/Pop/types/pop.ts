/**
 * Type mappings for the POP node
 *
 * Defines the resource-to-operation map used by the router to dispatch
 * calls and by each operation file to type its properties array.
 *
 * To add a new operation:
 * 1. Add the operation value string to the appropriate resource array in popMap
 * 2. Create a new operation module (e.g. invoices/newOperation.ts)
 * 3. Export it from the resource's index.ts
 */
import { AllEntities, Entity, PropertiesOf } from 'n8n-workflow';

/**
 * Master map of all resources and their available operations.
 * Each key is a resource name; its value is a readonly tuple of operation identifiers.
 */
export const popMap = {
	invoices: ['createSdiInvoiceXml', 'createPeppolInvoiceUbl', 'getInvoiceStatus', 'getPeppolDocument'],
} as const;

/** Typed map: resource key → union of its operation strings */
export type PopMap = {
	[K in keyof typeof popMap]: (typeof popMap)[K][number];
};

/** Union of all resource names (currently just 'invoices') */
export type PopAllEntities = AllEntities<PopMap>;

/** Entity type for the invoices resource — used to type operation properties */
export type InvoicesEntity = Entity<PopMap, 'invoices'>;

/** Properties array type for invoices operations */
export type InvoicesProperties = PropertiesOf<InvoicesEntity>;
