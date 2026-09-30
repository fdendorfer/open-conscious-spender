import { expect, test } from '@playwright/test';

test.describe('branding assets', () => {
	test('the favicon, icons and share image all resolve', async ({ request }) => {
		for (const path of ['/icon.svg', '/og-image.png', '/pwa-192x192.png', '/pwa-512x512.png']) {
			const res = await request.get(path);
			expect(res.status(), path).toBe(200);
		}
	});

	test('the share image is the wide one, not the square icon', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
			'content',
			/og-image\.png$/
		);
		await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
			'content',
			'summary_large_image'
		);
	});

	// The icons are generated from the header mark, so both must draw the same path.
	test('the generated icon uses the header logo artwork', async ({ page, request }) => {
		await page.goto('/');
		const headerPath = await page.locator('nav svg path').first().getAttribute('d');
		const icon = await (await request.get('/icon.svg')).text();
		expect(icon).toContain(headerPath!.split(/\s+/)[0]);
	});

	test('the manifest advertises both PWA icons', async ({ request }) => {
		const manifest = await (await request.get('/manifest.webmanifest')).json();
		expect(manifest.icons.map((i: { src: string }) => i.src)).toEqual(
			expect.arrayContaining(['/pwa-192x192.png', '/pwa-512x512.png'])
		);
	});

	test('every page carries a distinct title', async ({ page }) => {
		const seen: string[] = [];
		for (const path of ['/', '/companies', '/scoring', '/shopping', '/settings']) {
			await page.goto(path);
			seen.push(await page.title());
		}
		expect(new Set(seen).size).toBe(seen.length);
	});
});
