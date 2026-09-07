/**
 * React binding for the digital-ink surface.
 *
 * The surface itself is imperative and framework-free; this component owns its
 * lifetime and renders an accessible toolbar over it. Every control is a real
 * button with a real accessible name, reachable by keyboard, and every state
 * that matters is conveyed by text and `aria-pressed` rather than by colour
 * alone (specification section 11).
 *
 * Clearing asks first. Undo can recover a cleared page, but a writer who has
 * just lost a page of handwriting should not have to know that.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
	InkDocument,
	InkMode,
	InkStroke,
	InkSurface,
	InkToolType,
} from '@starisian/3iatlas-input-ink';
import { mountInkSurface } from '@starisian/3iatlas-input-ink';

/** Localized labels for the ink toolbar. */
export interface InkToolbarLabels {
	readonly pen: string;
	readonly highlighter: string;
	readonly eraser: string;
	readonly select: string;
	readonly undo: string;
	readonly redo: string;
	readonly clear: string;
	readonly deleteSelection: string;
	readonly confirmClear: string;
	readonly cancelClear: string;
	readonly clearPrompt: string;
	readonly surface: string;
}

/** Props accepted by {@link InkCanvas}. */
export interface InkCanvasProps {
	readonly labels: InkToolbarLabels;
	/** Document to open. Omit to start a blank page. */
	readonly document?: InkDocument;
	/** Receives the surface handle once mounted, and null on unmount. */
	readonly onReady?: (surface: InkSurface | null) => void;
	readonly onChange?: (document: InkDocument) => void;
	readonly onStrokeEnd?: (stroke: InkStroke) => void;
	/** Height of the drawing area. Defaults to a comfortable writing band. */
	readonly heightPx?: number;
	readonly className?: string;
}

/** Minimum touch target, matching the helper bar's rule in section 6.3. */
const MINIMUM_TOUCH_TARGET_PX = 44;

/** Shared styling for every toolbar control. */
const controlStyle = {
	minWidth: `${MINIMUM_TOUCH_TARGET_PX}px`,
	minHeight: `${MINIMUM_TOUCH_TARGET_PX}px`,
};

/**
 * Renders a digital-ink surface with an accessible toolbar.
 *
 * @param props Canvas configuration.
 * @return The canvas element.
 */
export const InkCanvas = ({
	labels,
	document,
	onReady,
	onChange,
	onStrokeEnd,
	heightPx = 220,
	className,
}: InkCanvasProps): JSX.Element => {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const surfaceRef = useRef<InkSurface | null>(null);
	const [tool, setToolState] = useState<InkToolType>('pen');
	const [mode, setModeState] = useState<InkMode>('draw');
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [hasSelection, setHasSelection] = useState(false);
	const [confirmingClear, setConfirmingClear] = useState(false);

	// The callbacks are held in refs so that a consumer passing an inline
	// arrow function does not tear down and remount the surface — which would
	// discard the writer's strokes on every parent render.
	const onChangeRef = useRef(onChange);
	const onStrokeEndRef = useRef(onStrokeEnd);
	const onReadyRef = useRef(onReady);

	onChangeRef.current = onChange;
	onStrokeEndRef.current = onStrokeEnd;
	onReadyRef.current = onReady;

	useEffect(() => {
		const host = hostRef.current;

		if (host === null) {
			return undefined;
		}

		const surface = mountInkSurface(host, {
			...(document === undefined ? {} : { document }),
			label: labels.surface,
			onChange: (next) => {
				setCanUndo(surface.model.canUndo);
				setCanRedo(surface.model.canRedo);
				setHasSelection(surface.model.selection.length > 0);
				onChangeRef.current?.(next);
			},
			onStrokeEnd: (stroke) => onStrokeEndRef.current?.(stroke),
		});

		surfaceRef.current = surface;

		// The replacement surface starts on pen/draw with empty history, so
		// the toolbar has to start there too. Without this the toolbar could
		// mark Highlighter or Eraser active, and enable Undo, for state that
		// belonged to the previous page.
		setToolState(surface.getTool());
		setModeState(surface.getMode());
		setCanUndo(surface.model.canUndo);
		setCanRedo(surface.model.canRedo);
		setHasSelection(surface.model.selection.length > 0);
		setConfirmingClear(false);

		onReadyRef.current?.(surface);

		return () => {
			surfaceRef.current = null;
			onReadyRef.current?.(null);
			surface.destroy();
		};
		// `document` and the surface label define which page is mounted;
		// remounting when they change is the intended behavior.
	}, [document, labels.surface]);

	const setTool = useCallback((next: InkToolType) => {
		setToolState(next);
		setModeState('draw');
		surfaceRef.current?.setTool(next);
		surfaceRef.current?.setMode('draw');
	}, []);

	const setMode = useCallback((next: InkMode) => {
		setModeState(next);
		surfaceRef.current?.setMode(next);
	}, []);

	const refresh = useCallback(() => {
		const surface = surfaceRef.current;

		if (surface === null) {
			return;
		}

		setCanUndo(surface.model.canUndo);
		setCanRedo(surface.model.canRedo);
		setHasSelection(surface.model.selection.length > 0);
	}, []);

	return (
		<div className={className}>
			<div
				className="tiatlas-ink__toolbar"
				role="toolbar"
				aria-label={labels.surface}
			>
				<button
					type="button"
					style={controlStyle}
					aria-pressed={mode === 'draw' && tool === 'pen'}
					onClick={() => setTool('pen')}
				>
					{labels.pen}
				</button>
				<button
					type="button"
					style={controlStyle}
					aria-pressed={mode === 'draw' && tool === 'highlighter'}
					onClick={() => setTool('highlighter')}
				>
					{labels.highlighter}
				</button>
				<button
					type="button"
					style={controlStyle}
					aria-pressed={mode === 'erase'}
					onClick={() => setMode('erase')}
				>
					{labels.eraser}
				</button>
				<button
					type="button"
					style={controlStyle}
					aria-pressed={mode === 'select'}
					onClick={() => setMode('select')}
				>
					{labels.select}
				</button>
				<button
					type="button"
					style={controlStyle}
					disabled={!canUndo}
					onClick={() => {
						surfaceRef.current?.undo();
						refresh();
					}}
				>
					{labels.undo}
				</button>
				<button
					type="button"
					style={controlStyle}
					disabled={!canRedo}
					onClick={() => {
						surfaceRef.current?.redo();
						refresh();
					}}
				>
					{labels.redo}
				</button>
				<button
					type="button"
					style={controlStyle}
					disabled={!hasSelection}
					onClick={() => {
						surfaceRef.current?.deleteSelection();
						refresh();
					}}
				>
					{labels.deleteSelection}
				</button>
				<button
					type="button"
					style={controlStyle}
					onClick={() => setConfirmingClear(true)}
				>
					{labels.clear}
				</button>
			</div>

			{confirmingClear && (
				<div
					className="tiatlas-ink__confirm"
					role="alertdialog"
					aria-modal="false"
				>
					<p>{labels.clearPrompt}</p>
					<button
						type="button"
						style={controlStyle}
						onClick={() => {
							surfaceRef.current?.clear();
							setConfirmingClear(false);
							refresh();
						}}
					>
						{labels.confirmClear}
					</button>
					<button
						type="button"
						style={controlStyle}
						onClick={() => setConfirmingClear(false)}
					>
						{labels.cancelClear}
					</button>
				</div>
			)}

			<div
				ref={hostRef}
				className="tiatlas-ink__surface"
				style={{ height: `${heightPx}px`, width: '100%' }}
			/>
		</div>
	);
};
