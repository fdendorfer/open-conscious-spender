// Prerendered so the app shell is a static file the service worker can precache —
// without it workbox's navigateFallback points at a '/' that was never cached.
export const prerender = true;
