export function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: { 'content-type': 'application/json', ...init.headers }
	});
}

export class ValidationError extends Error {}

export function assertString(value: unknown, field: string, maxLen: number): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new ValidationError(`"${field}" must be a non-empty string`);
	}
	if (value.length > maxLen) {
		throw new ValidationError(`"${field}" exceeds max length of ${maxLen}`);
	}
	return value.trim();
}

export function assertOptionalString(value: unknown, field: string, maxLen: number): string | null {
	if (value === undefined || value === null) return null;
	return assertString(value, field, maxLen);
}

export function assertOneOf<T extends string>(
	value: unknown,
	field: string,
	allowed: readonly T[]
): T {
	if (typeof value !== 'string' || !allowed.includes(value as T)) {
		throw new ValidationError(`"${field}" must be one of: ${allowed.join(', ')}`);
	}
	return value as T;
}
