/**
 * Mountable digital-ink surface.
 *
 * The only module in this package that touches the DOM. It owns a canvas, the
 * pointer plumbing, and the repaint loop; everything it knows about ink itself
 * it delegates to the model and the renderer.
 *
 * Two performance rules from the repository standard shape the design:
 * repaints are batched into one `requestAnimationFrame` rather than running
 * per pointer event, and the pointer handler itself only appends to an array.
 * `getCoalescedEvents` is used so batching costs no stroke fidelity — the
 * browser hands over every sample it took between frames, which is how a
 * 240 Hz pen survives a 60 Hz repaint.
 */

import type {
	InkCanvasSize,
	InkDocument,
	InkPoint,
	InkStroke,
	InkToolType,
} from './schema';
import { NO_PRESSURE, createInkId } from './schema';
import { InkDocumentModel } from './model';
import type { InkToolPreset } from './render';
import {
	DEFAULT_TOOL_PRESETS,
	inkDocumentToSvg,
	renderInkToCanvas,
} from './render';
import type { PalmRejectionOptions, PalmRejectionState } from './pointer';
import {
	admitPointerSample,
	advancePalmRejection,
	toInkPointerType,
} from './pointer';

/** What the writer is currently doing with the pointer. */
export type InkMode = 'draw' | 'erase' | 'select';

/** Options accepted by {@link mountInkSurface}. */
export interface InkSurfaceOptions {
	/** Document to open. A new empty document is created when omitted. */
	readonly document?: InkDocument;
	readonly tool?: InkToolType;
	readonly mode?: InkMode;
	readonly presets?: Readonly<Record<InkToolType, InkToolPreset>>;
	/** Eraser and selection hit radius, in CSS pixels. */
	readonly hitTolerancePx?: number;
	readonly palmRejection?: PalmRejectionOptions;
	/**
	 * Accessible name for the drawing surface.
	 *
	 * REQUIRED, and deliberately so: this package ships no user-facing English.
	 * A default here would put an untranslated string in front of a Mandinka
	 * writer and their screen reader. The consuming product owns localization.
	 */
	readonly label: string;
	/** Notified after every accepted change. */
	readonly onChange?: (document: InkDocument) => void;
	/** Notified when a stroke is completed. */
	readonly onStrokeEnd?: (stroke: InkStroke) => void;
}

/** Imperative handle returned by {@link mountInkSurface}. */
export interface InkSurface {
	readonly model: InkDocumentModel;
	readonly setTool: (tool: InkToolType) => void;
	readonly getTool: () => InkToolType;
	readonly setMode: (mode: InkMode) => void;
	readonly getMode: () => InkMode;
	readonly undo: () => boolean;
	readonly redo: () => boolean;
	readonly clear: () => boolean;
	readonly deleteSelection: () => boolean;
	/** Serializes the current document. */
	readonly serialize: () => InkDocument;
	/** Replaces the document, e.g. reopening a saved page. */
	readonly restore: (document: InkDocument) => void;
	readonly toSvg: (options?: { readonly trim?: boolean }) => string;
	/**
	 * Rasterizes the surface.
	 *
	 * Resolves to null where the platform declines to produce a blob, which a
	 * caller must handle rather than treat as an empty page.
	 */
	readonly toPngBlob: () => Promise<Blob | null>;
	/** Re-measures the host element and repaints. */
	readonly resize: () => void;
	readonly destroy: () => void;
}

/** Minimum sensible surface size, so a hidden host still yields a valid document. */
const MIN_DIMENSION_PX = 1;

/**
 * Ceiling on a rasterized export, in bytes.
 *
 * The repository standard fails a build for an in-memory blob over 5 MB, and
 * that limit exists because these devices are memory-poor.
 */
export const MAX_PNG_BLOB_BYTES = 5 * 1024 * 1024;

/**
 * Mounts an ink surface inside a host element.
 *
 * @param host    Element to draw in. Its size governs the surface size.
 * @param options Surface configuration.
 * @return The imperative handle.
 */
export const mountInkSurface = (
	host: HTMLElement,
	options: InkSurfaceOptions
): InkSurface => {
	const ownerDocument = host.ownerDocument;
	const view = ownerDocument.defaultView;
	const presets = options.presets ?? DEFAULT_TOOL_PRESETS;
	const hitTolerance = options.hitTolerancePx ?? 6;

	const canvas = ownerDocument.createElement('canvas');

	canvas.style.display = 'block';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	// The browser must not treat a stroke as a scroll or a pinch. Without
	// this the first pointermove is swallowed as a gesture and the stroke
	// starts a few pixels late.
	canvas.style.touchAction = 'none';
	canvas.setAttribute('role', 'img');
	canvas.setAttribute('aria-label', options.label);

	host.appendChild(canvas);

	const context = canvas.getContext('2d');

	const measure = (): InkCanvasSize => {
		const rect = canvas.getBoundingClientRect();

		return {
			widthPx: Math.max(MIN_DIMENSION_PX, Math.round(rect.width)),
			heightPx: Math.max(MIN_DIMENSION_PX, Math.round(rect.height)),
			dpr: view?.devicePixelRatio ?? 1,
		};
	};

	const model =
		options.document === undefined
			? InkDocumentModel.empty(measure())
			: new InkDocumentModel(options.document);

	let tool: InkToolType = options.tool ?? 'pen';
	let mode: InkMode = options.mode ?? 'draw';
	let palmState: PalmRejectionState = { lastPenAt: null };
	let livePoints: InkPoint[] = [];
	let liveStroke: Omit<InkStroke, 'points'> | null = null;
	let activePointerId: number | null = null;
	let frame: number | null = null;
	let destroyed = false;

	/** Document coordinates per CSS pixel of the current surface. */
	const currentScale = (): number => {
		const size = measure();
		const recorded = model.document.canvas;

		// Fit the recorded page into the surface without distorting the
		// handwriting: one factor for both axes, chosen so nothing is cropped.
		return Math.min(
			size.widthPx / recorded.widthPx,
			size.heightPx / recorded.heightPx
		);
	};

	const paint = (): void => {
		frame = null;

		if (destroyed || context === null) {
			return;
		}

		const size = measure();
		const dpr = size.dpr;

		if (
			canvas.width !== Math.round(size.widthPx * dpr) ||
			canvas.height !== Math.round(size.heightPx * dpr)
		) {
			canvas.width = Math.round(size.widthPx * dpr);
			canvas.height = Math.round(size.heightPx * dpr);
		}

		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.clearRect(0, 0, size.widthPx, size.heightPx);

		const scale = currentScale();

		renderInkToCanvas(context, model.document.strokes, {
			presets,
			scale,
			selectedIds: model.selection,
		});

		// The in-progress stroke is drawn from the live buffer rather than
		// being committed to the model on every sample: a half-finished
		// stroke is not an undoable edit.
		if (liveStroke !== null && livePoints.length > 0) {
			renderInkToCanvas(context, [{ ...liveStroke, points: livePoints }], {
				presets,
				scale,
			});
		}
	};

	const schedulePaint = (): void => {
		if (destroyed || frame !== null) {
			return;
		}

		if (typeof view?.requestAnimationFrame !== 'function') {
			paint();

			return;
		}

		frame = view.requestAnimationFrame(paint);
	};

	const unsubscribe = model.subscribe((document) => {
		schedulePaint();
		options.onChange?.(document);
	});

	/**
	 * Converts a client-space event position into document coordinates.
	 *
	 * @param clientX Event x.
	 * @param clientY Event y.
	 * @return Document-space coordinates.
	 */
	const toDocumentSpace = (
		clientX: number,
		clientY: number
	): { x: number; y: number } => {
		const rect = canvas.getBoundingClientRect();
		const scale = currentScale();

		return {
			x: (clientX - rect.left) / scale,
			y: (clientY - rect.top) / scale,
		};
	};

	/**
	 * Reads the pressure a sample carries, or the no-data marker.
	 *
	 * @param event Pointer event.
	 * @return Pressure in 0..1, or {@link NO_PRESSURE}.
	 */
	const readPressure = (event: PointerEvent): number => {
		// Pointer Events specify 0.5 for devices with no pressure sensor, and
		// 0 while a pen hovers. Neither is a measurement, so neither is stored
		// as one.
		if (event.pointerType === 'mouse') {
			return NO_PRESSURE;
		}

		if (event.pressure === 0 || event.pressure === 0.5) {
			return NO_PRESSURE;
		}

		return event.pressure;
	};

	const appendSample = (event: PointerEvent, startedAt: number): void => {
		const { x, y } = toDocumentSpace(event.clientX, event.clientY);

		livePoints.push({
			x,
			y,
			pressure: readPressure(event),
			t: Math.max(0, Math.round(performanceNow() - startedAt)),
		});
	};

	const performanceNow = (): number => {
		const performanceApi = (
			globalThis as { performance?: { now?: () => number } }
		).performance;

		return typeof performanceApi?.now === 'function'
			? performanceApi.now()
			: Date.now();
	};

	let strokeStartedAt = 0;

	/**
	 * Appends an event's samples, preferring the browser's coalesced batch.
	 *
	 * Shared by `pointermove` and `pointerup` so both record the same way.
	 *
	 * @param event     Pointer event to sample.
	 * @param startedAt Stroke start, for the relative timestamp.
	 */
	const appendCoalesced = (event: PointerEvent, startedAt: number): void => {
		const coalesced =
			typeof event.getCoalescedEvents === 'function'
				? event.getCoalescedEvents()
				: [];
		const samples = coalesced.length > 0 ? coalesced : [event];

		for (const sample of samples) {
			appendSample(sample, startedAt);
		}
	};

	/**
	 * Takes pointer capture, tolerating a browser that refuses.
	 *
	 * Capture is an ENHANCEMENT — it keeps a stroke attached when the pen
	 * leaves the canvas mid-word — not a precondition for drawing. The call
	 * throws `NotFoundError` whenever the pointer id is not currently active,
	 * which happens for a synthetic event and for a pointer released between
	 * the event being queued and the handler running. Letting that propagate
	 * would abort the handler before the stroke is even started, so the writer
	 * would press the pen down and get nothing.
	 *
	 * @param pointerId Pointer to capture.
	 */
	const tryCapture = (pointerId: number): void => {
		try {
			canvas.setPointerCapture(pointerId);
		} catch {
			// Drawing continues without capture.
		}
	};

	/**
	 * Releases pointer capture if this element holds it.
	 *
	 * @param pointerId Pointer to release.
	 */
	const tryRelease = (pointerId: number): void => {
		try {
			if (canvas.hasPointerCapture(pointerId)) {
				canvas.releasePointerCapture(pointerId);
			}
		} catch {
			// Already released, or never held.
		}
	};

	const onPointerDown = (event: PointerEvent): void => {
		// One live stroke at a time. A second contact arriving mid-stroke used
		// to overwrite `liveStroke`/`livePoints`, so the first pointer's
		// buffered handwriting was silently thrown away and only the newer
		// pointer could commit. Ignoring the newcomer keeps the mark the
		// writer is actually making.
		if (activePointerId !== null && activePointerId !== event.pointerId) {
			return;
		}

		const now = performanceNow();
		const admission = admitPointerSample(
			event,
			palmState,
			now,
			options.palmRejection
		);

		palmState = advancePalmRejection(palmState, event, now);

		if (!admission.accepted) {
			return;
		}

		const point = toDocumentSpace(event.clientX, event.clientY);

		if (mode === 'erase') {
			activePointerId = event.pointerId;
			tryCapture(event.pointerId);
			model.eraseAt(point.x, point.y, hitTolerance);

			return;
		}

		if (mode === 'select') {
			model.selectAt(point.x, point.y, hitTolerance, event.shiftKey);

			return;
		}

		const preset = presets[tool];

		activePointerId = event.pointerId;
		// Capture keeps the stroke attached to this element even when the pen
		// leaves the canvas mid-word, so a stroke is never truncated at the
		// edge of the page. Best-effort: see `tryCapture`.
		tryCapture(event.pointerId);
		strokeStartedAt = now;
		liveStroke = {
			id: createInkId('stroke'),
			tool,
			pointerType: toInkPointerType(event.pointerType),
			color: preset.color,
			sizePx: preset.sizePx,
			opacity: preset.opacity,
			startedAt: Date.now(),
		};
		livePoints = [];
		appendSample(event, strokeStartedAt);
		schedulePaint();
	};

	const onPointerMove = (event: PointerEvent): void => {
		if (activePointerId !== event.pointerId) {
			return;
		}

		const now = performanceNow();
		const admission = admitPointerSample(
			event,
			palmState,
			now,
			options.palmRejection
		);

		palmState = advancePalmRejection(palmState, event, now);

		if (!admission.accepted) {
			return;
		}

		if (mode === 'erase') {
			const point = toDocumentSpace(event.clientX, event.clientY);

			model.eraseAt(point.x, point.y, hitTolerance);

			return;
		}

		if (liveStroke === null) {
			return;
		}

		// Every sample the browser took since the last frame, not just the
		// one it chose to deliver. This is what keeps a fast stroke smooth
		// without raising the handler rate.
		appendCoalesced(event, strokeStartedAt);

		schedulePaint();
	};

	const finishStroke = (event: PointerEvent): void => {
		if (activePointerId !== event.pointerId) {
			return;
		}

		tryRelease(event.pointerId);

		activePointerId = null;

		if (liveStroke === null) {
			return;
		}

		// Append where the pointer actually lifted. Without this a fast stroke
		// that travelled between two delivered `pointermove` events — or that
		// only ever produced a down and an up — was saved short of where the
		// writer stopped, or as a bare dot.
		if (event.buttons !== 0 || livePoints.length > 0) {
			appendCoalesced(event, strokeStartedAt);
		}

		const stroke: InkStroke = { ...liveStroke, points: livePoints };

		liveStroke = null;
		livePoints = [];

		if (model.addStroke(stroke)) {
			options.onStrokeEnd?.(stroke);
		}

		schedulePaint();
	};

	const onPointerCancel = (event: PointerEvent): void => {
		if (activePointerId !== event.pointerId) {
			return;
		}

		// A cancelled stroke is discarded rather than committed: the browser
		// took the pointer away, so the writer never finished the mark.
		tryRelease(event.pointerId);

		activePointerId = null;
		liveStroke = null;
		livePoints = [];
		schedulePaint();
	};

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerup', finishStroke);
	canvas.addEventListener('pointercancel', onPointerCancel);

	let resizeObserver: ResizeObserver | null = null;

	const ResizeObserverCtor = (
		globalThis as { ResizeObserver?: typeof ResizeObserver }
	).ResizeObserver;

	if (typeof ResizeObserverCtor === 'function') {
		resizeObserver = new ResizeObserverCtor(() => {
			schedulePaint();
		});
		resizeObserver.observe(canvas);
	} else if (view !== null) {
		// A browser without ResizeObserver still has to repaint on rotation.
		view.addEventListener('resize', schedulePaint);
	}

	schedulePaint();

	return {
		model,
		setTool: (next) => {
			tool = next;
		},
		getTool: () => tool,
		setMode: (next) => {
			mode = next;

			if (next !== 'select') {
				model.setSelection([]);
			}
		},
		getMode: () => mode,
		undo: () => model.undo(),
		redo: () => model.redo(),
		clear: () => model.clear(),
		deleteSelection: () => model.deleteSelection(),
		serialize: () => model.document,
		restore: (document) => {
			model.restore(document);
			schedulePaint();
		},
		toSvg: (svgOptions) =>
			inkDocumentToSvg(model.document, {
				presets,
				trim: svgOptions?.trim ?? true,
				title: options.label,
			}),
		toPngBlob: () =>
			new Promise<Blob | null>((resolve) => {
				if (typeof canvas.toBlob !== 'function') {
					resolve(null);

					return;
				}

				// Model edits are synchronous but painting is frame-batched, so
				// an export requested right after adding, erasing, restoring or
				// clearing ink would otherwise rasterize the PREVIOUS frame —
				// disagreeing with what `serialize` and `toSvg` return. Flush
				// the pending frame first.
				if (
					frame !== null &&
					typeof view?.cancelAnimationFrame === 'function'
				) {
					view.cancelAnimationFrame(frame);
					frame = null;
				}

				paint();

				try {
					canvas.toBlob((blob) => {
						// The repository standard caps an in-memory blob at
						// 5 MB. A large, high-density page can exceed that, and
						// handing back an oversized raster is worse than
						// reporting that PNG export is not available for it —
						// SVG export has no such limit.
						if (blob !== null && blob.size > MAX_PNG_BLOB_BYTES) {
							resolve(null);

							return;
						}

						resolve(blob);
					}, 'image/png');
				} catch {
					resolve(null);
				}
			}),
		resize: () => {
			model.setCanvasSize(measure());
			schedulePaint();
		},
		destroy: () => {
			destroyed = true;
			unsubscribe();
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', finishStroke);
			canvas.removeEventListener('pointercancel', onPointerCancel);
			resizeObserver?.disconnect();
			view?.removeEventListener('resize', schedulePaint);

			if (frame !== null && typeof view?.cancelAnimationFrame === 'function') {
				view.cancelAnimationFrame(frame);
			}

			canvas.remove();
		},
	};
};
