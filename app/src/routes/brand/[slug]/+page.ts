// One page per company id is not enumerable at build time; the service
// worker serves /shell for it and the client resolves the slug from the dataset.
export const prerender = false;
