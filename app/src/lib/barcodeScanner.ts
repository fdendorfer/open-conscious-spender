// Side-effect import: sets globalThis.BarcodeDetector to the WASM-based
// polyfill unless the browser already has a native implementation (Chrome/Edge
// on Android) — see barcode-detector's polyfill.js. Using the ambient global
// this way (rather than the package's named export) is what lets native
// detection win when it's there instead of always paying for WASM decoding.
import 'barcode-detector';

export interface ScanHandle {
	stop: () => void;
}

const PRODUCT_BARCODE_FORMATS: BarcodeFormat[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export class CameraUnavailableError extends Error {}

/**
 * Starts scanning `videoEl`'s camera feed for a product barcode. Calls
 * `onDetect` at most once per scan (caller decides whether to `stop()` or
 * keep scanning for another product). Always call `stop()` when done to
 * release the camera.
 */
export async function startBarcodeScan(
	videoEl: HTMLVideoElement,
	onDetect: (rawValue: string) => void
): Promise<ScanHandle> {
	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: 'environment' }
		});
	} catch (err) {
		throw new CameraUnavailableError(err instanceof Error ? err.message : 'camera access failed');
	}

	videoEl.srcObject = stream;
	await videoEl.play();

	const detector = new BarcodeDetector({ formats: PRODUCT_BARCODE_FORMATS });
	let stopped = false;
	let rafId = 0;

	const tick = async () => {
		if (stopped) return;
		try {
			const barcodes = await detector.detect(videoEl);
			if (barcodes.length > 0) {
				onDetect(barcodes[0].rawValue);
				return;
			}
		} catch {
			// transient mid-frame decode errors are expected — keep scanning
		}
		if (!stopped) rafId = requestAnimationFrame(tick);
	};
	rafId = requestAnimationFrame(tick);

	return {
		stop: () => {
			stopped = true;
			cancelAnimationFrame(rafId);
			stream.getTracks().forEach((track) => track.stop());
		}
	};
}
