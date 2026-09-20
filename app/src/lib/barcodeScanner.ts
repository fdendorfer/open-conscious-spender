// Side-effect import: sets globalThis.BarcodeDetector to the WASM-based
// polyfill unless the browser already has a native implementation (Chrome/Edge
// on Android) — see barcode-detector's polyfill.js. Using the ambient global
// this way (rather than the package's named export) is what lets native
// detection win when it's there instead of always paying for WASM decoding.
import 'barcode-detector';

export interface ScanHandle {
	/** Halts detection but keeps the camera stream live, so `resume()` is instant. */
	pause: () => void;
	resume: () => void;
	/** Releases the camera. The handle is inert afterwards. */
	stop: () => void;
}

const PRODUCT_BARCODE_FORMATS: BarcodeFormat[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export class CameraUnavailableError extends Error {}

/**
 * Starts scanning `videoEl`'s camera feed for a product barcode. Detection
 * pauses itself on each hit; call `resume()` to scan the next product.
 * Always call `stop()` when done to release the camera.
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
	let running = false;
	let rafId = 0;

	const tick = async () => {
		if (stopped || !running) return;
		try {
			const barcodes = await detector.detect(videoEl);
			if (barcodes.length > 0) {
				// Self-pause so one product can't fire a burst of detections.
				running = false;
				onDetect(barcodes[0].rawValue);
				return;
			}
		} catch {
			// transient mid-frame decode errors are expected — keep scanning
		}
		if (!stopped && running) rafId = requestAnimationFrame(tick);
	};

	const pause = () => {
		running = false;
		cancelAnimationFrame(rafId);
	};

	const resume = () => {
		if (stopped || running) return;
		running = true;
		rafId = requestAnimationFrame(tick);
	};

	resume();

	return {
		pause,
		resume,
		stop: () => {
			stopped = true;
			pause();
			stream.getTracks().forEach((track) => track.stop());
		}
	};
}
