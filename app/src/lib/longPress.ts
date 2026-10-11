import type { Action } from 'svelte/action';

const HOLD_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Calls `onLongPress` with the element when the element is held down, and swallows the click that
 * ends the hold so the element's normal action does not run.
 */
export const longPress: Action<HTMLElement, (node: HTMLElement) => void> = (node, initial) => {
	let onLongPress = initial;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let start: { x: number; y: number } | null = null;
	let fired = false;

	function cancel() {
		clearTimeout(timer);
		timer = undefined;
		start = null;
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		fired = false;
		start = { x: e.clientX, y: e.clientY };
		timer = setTimeout(() => {
			fired = true;
			timer = undefined;
			onLongPress?.(node);
		}, HOLD_MS);
	}

	function onPointerMove(e: PointerEvent) {
		if (!start) return;
		if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
	}

	function onClick(e: MouseEvent) {
		if (!fired) return;
		fired = false;
		e.preventDefault();
		e.stopImmediatePropagation();
	}

	// Mobile browsers open their own context menu on a long press.
	function onContextMenu(e: Event) {
		e.preventDefault();
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', cancel);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('pointerleave', cancel);
	node.addEventListener('click', onClick, { capture: true });
	node.addEventListener('contextmenu', onContextMenu);

	return {
		update(next) {
			onLongPress = next;
		},
		destroy() {
			cancel();
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('pointerleave', cancel);
			node.removeEventListener('click', onClick, { capture: true });
			node.removeEventListener('contextmenu', onContextMenu);
		}
	};
};
