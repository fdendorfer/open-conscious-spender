#!/usr/bin/env node
// Generates the favicon, the OG share image and the PWA app icons referenced in
// vite.config.ts's manifest, from the same mark the header renders
// (src/lib/logoArtwork.js) so the two can never drift apart.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGO_BOUNDS, LOGO_PATHS } from '../src/lib/logoArtwork.js';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'static');

const BG = '#111111';
const MARK = '#ffffff';

const CANVAS = 512;
// Maskable icons are cropped to the middle ~80%; keeping the mark inside 65%
// leaves the safe zone intact on every platform's mask shape.
const MARK_HEIGHT = CANVAS * 0.65;

function markGroup(canvas = CANVAS, markHeight = MARK_HEIGHT) {
	const scale = markHeight / LOGO_BOUNDS.height;
	const tx = canvas / 2 - (LOGO_BOUNDS.x + LOGO_BOUNDS.width / 2) * scale;
	const ty = canvas / 2 - (LOGO_BOUNDS.y + LOGO_BOUNDS.height / 2) * scale;
	const paths = LOGO_PATHS.map((d) => `<path d="${d}" />`).join('\n\t\t');
	return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})" fill="${MARK}">
		${paths}
	</g>`;
}

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
	<rect width="${CANVAS}" height="${CANVAS}" rx="100" fill="${BG}" />
	${markGroup()}
</svg>`;

// Link previews crop to a wide aspect, so the square icon would lose its padding.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const share = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
	<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${BG}" />
	<g transform="translate(${(OG_WIDTH - OG_HEIGHT) / 2} 0)">
		${markGroup(OG_HEIGHT, OG_HEIGHT * 0.45)}
	</g>
</svg>`;

async function main() {
	await mkdir(outDir, { recursive: true });
	await writeFile(path.join(outDir, 'icon.svg'), icon);

	for (const size of [192, 512]) {
		await sharp(Buffer.from(icon))
			.resize(size, size)
			.png()
			.toFile(path.join(outDir, `pwa-${size}x${size}.png`));
	}

	await sharp(Buffer.from(share)).png().toFile(path.join(outDir, 'og-image.png'));

	console.log('Generated static/icon.svg, static/pwa-{192,512}.png, static/og-image.png');
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
