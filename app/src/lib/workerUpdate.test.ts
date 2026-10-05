import { describe, expect, it } from 'vitest';
import { activateLatestWorker } from './workerUpdate';

type State = ServiceWorkerState;

function fakeWorker(state: State) {
	const listeners: (() => void)[] = [];
	return {
		state,
		addEventListener: (_: string, fn: () => void) => listeners.push(fn),
		moveTo(next: State) {
			this.state = next;
			listeners.forEach((fn) => fn());
		}
	};
}

function fakeContainer(opts: {
	installing?: ReturnType<typeof fakeWorker>;
	updateFails?: boolean;
}) {
	const registration = {
		installing: null as ReturnType<typeof fakeWorker> | null,
		waiting: null,
		update: async () => {
			if (opts.updateFails) throw new TypeError('Failed to fetch');
			registration.installing = opts.installing ?? null;
		}
	};
	return { getRegistration: async () => registration } as unknown as ServiceWorkerContainer;
}

describe('activateLatestWorker', () => {
	it('resolves true once the new worker activates', async () => {
		const worker = fakeWorker('installing');
		const done = activateLatestWorker(fakeContainer({ installing: worker }), false);
		worker.moveTo('installed');
		worker.moveTo('activated');
		expect(await done).toBe(true);
	});

	it('resolves false when the new worker fails to install', async () => {
		const worker = fakeWorker('installing');
		const done = activateLatestWorker(fakeContainer({ installing: worker }), false);
		worker.moveTo('redundant');
		expect(await done).toBe(false);
	});

	it('resolves false when the install never finishes', async () => {
		const worker = fakeWorker('installing');
		expect(await activateLatestWorker(fakeContainer({ installing: worker }), false, 10)).toBe(
			false
		);
	});

	it('rejects when the worker script cannot be fetched', async () => {
		await expect(
			activateLatestWorker(fakeContainer({ updateFails: true }), false)
		).rejects.toThrow();
	});

	it('only reloads without a new worker if one already took over', async () => {
		expect(await activateLatestWorker(fakeContainer({}), false)).toBe(false);
		expect(await activateLatestWorker(fakeContainer({}), true)).toBe(true);
	});

	it('reloads straight away without service worker support', async () => {
		expect(await activateLatestWorker(undefined, false)).toBe(true);
	});
});
