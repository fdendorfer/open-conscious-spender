/**
 * The scanner overlay is rendered once by the navbar so it survives navigation.
 * This lets any page ask for it — e.g. "Start now" on the shopping mode intro.
 */
class ScannerBus {
	isOpen = $state(false);

	open() {
		this.isOpen = true;
	}

	close() {
		this.isOpen = false;
	}
}

export const scanner = new ScannerBus();
