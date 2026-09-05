#!/usr/bin/env node
// Bundles data/** into data/dist/bundle.json + data/dist/meta.json.
// meta.json is fetched cheaply by the PWA to detect staleness (see docs/ARCHITECTURE.md);
// bundle.json is fetched (pinned to the commit sha in meta.json) only when it changes.

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(rootDir, 'data');
const distDir = path.join(dataDir, 'dist');

async function readJsonDir(dirPath) {
	if (!existsSync(dirPath)) return [];
	const files = (await readdir(dirPath)).filter((f) => f.endsWith('.json'));
	return Promise.all(
		files.map(async (file) => JSON.parse(await readFile(path.join(dirPath, file), 'utf-8')))
	);
}

async function build() {
	const categories = JSON.parse(await readFile(path.join(dataDir, 'categories.json'), 'utf-8'));
	const companies = await readJsonDir(path.join(dataDir, 'companies'));
	const barcodeOverrides = JSON.parse(
		await readFile(path.join(dataDir, 'products', 'barcode-overrides.json'), 'utf-8')
	);
	// strip the human-readable comment key before shipping to clients
	delete barcodeOverrides._comment;

	const bundle = { categories, companies, barcodeOverrides };

	await mkdir(distDir, { recursive: true });
	await writeFile(path.join(distDir, 'bundle.json'), JSON.stringify(bundle));

	let version = 'local';
	try {
		version = execSync('git rev-parse --short HEAD', { cwd: rootDir }).toString().trim();
	} catch {
		// no git available (e.g. fresh checkout without history) — fall back to timestamp-based version
		version = `local-${Date.now()}`;
	}

	const meta = { version, builtAt: new Date().toISOString() };
	await writeFile(path.join(distDir, 'meta.json'), JSON.stringify(meta));

	console.log(`Built dataset bundle: ${companies.length} companies, ${categories.length} categories, version ${version}`);
}

build().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
