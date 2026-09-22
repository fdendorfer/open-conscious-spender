export const SITE_NAME = 'OCS';
export const SITE_FULL_NAME = 'Open Conscious Spender';
export const SITE_URL = 'https://open-conscious-spender.pages.dev';

export const SITE_DESCRIPTION =
	'Scan a barcode or search a company and see who owns the brand, what they have been flagged for, and a single score — in seconds, offline, in the aisle.';

/** Every page title goes through here, so the "<page> | OCS" format stays uniform. */
export function pageTitle(page: string): string {
	return `${page} | ${SITE_NAME}`;
}
