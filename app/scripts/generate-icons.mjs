#!/usr/bin/env node
// Generates the PWA app icons referenced in vite.config.ts's manifest.
// Design: a barcode (the app's core action) with a red flag planted on it
// (the app's core output) — a rounded-square mark with generous safe-zone
// padding so it doubles as a maskable icon.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'static');

const BG = '#111111';
const BAR = '#ffffff';
const FLAG = '#ef4444';

// deterministic bar widths for a barcode look, in a 512-wide viewBox
const BAR_WIDTHS = [10, 4, 8, 4, 14, 6, 4, 10, 6, 14, 4, 8, 4, 10, 6];
const BAR_GAP = 8;
const BAR_HEIGHT = 90;
const BAR_Y = 300;

function buildBars() {
	const totalWidth = BAR_WIDTHS.reduce((sum, w) => sum + w, 0) + BAR_GAP * (BAR_WIDTHS.length - 1);
	let x = (512 - totalWidth) / 2;
	const rects = BAR_WIDTHS.map((w) => {
		const rect = `<rect x="${x}" y="${BAR_Y}" width="${w}" height="${BAR_HEIGHT}" fill="${BAR}" />`;
		x += w + BAR_GAP;
		return rect;
	});
	return rects.join('\n\t');
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
	<rect width="512" height="512" rx="100" fill="${BG}" />
	${buildBars()}
	<rect x="216" y="140" width="10" height="180" fill="${BAR}" />
	<path d="M226 140 L226 195 L300 167.5 Z" fill="${FLAG}" />
</svg>`;

async function main() {
	await mkdir(outDir, { recursive: true });
	await writeFile(path.join(outDir, 'icon.svg'), svg);

	for (const size of [192, 512]) {
		await sharp(Buffer.from(svg))
			.resize(size, size)
			.png()
			.toFile(path.join(outDir, `pwa-${size}x${size}.png`));
	}

	console.log('Generated static/icon.svg, static/pwa-192x192.png, static/pwa-512x512.png');
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
