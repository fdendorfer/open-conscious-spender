import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Open Conscious Spender',
				short_name: 'OCS',
				description: 'Scan a barcode, see a company’s red flags, decide in seconds.',
				start_url: '/',
				display: 'standalone',
				background_color: '#ffffff',
				theme_color: '#111111',
				icons: [
					{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
					{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
				]
			},
			workbox: {
				// full dataset bundle is fetched by the app at runtime, not part of the build output,
				// so it needs its own runtime caching rule once data/dist/ is served
				globPatterns: ['**/*.{js,css,html,svg,png,ico}']
			}
		})
	]
});
