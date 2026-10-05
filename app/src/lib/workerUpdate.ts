/**
 * Resolves true once a worker holding the new build is active. The old worker keeps
 * serving until then, so a connection dropping mid-download never strands the app offline.
 */
export async function activateLatestWorker(
	container: ServiceWorkerContainer | undefined,
	controllerChanged: boolean,
	timeoutMs = 30_000
): Promise<boolean> {
	if (!container) return true;
	const registration = await container.getRegistration('/');
	if (!registration) return true;
	await registration.update();
	const next = registration.installing ?? registration.waiting;
	// No new worker means the new build is not reachable yet, unless one already took over.
	if (!next) return controllerChanged;
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(false), timeoutMs);
		const settle = () => {
			if (next.state !== 'activated' && next.state !== 'redundant') return;
			clearTimeout(timer);
			resolve(next.state === 'activated');
		};
		next.addEventListener('statechange', settle);
		settle();
	});
}
