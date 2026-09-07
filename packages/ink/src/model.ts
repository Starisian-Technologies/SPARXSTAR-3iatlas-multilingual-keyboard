/**
 * Editable ink document with bounded undo/redo.
 *
 * History is stored as EDITS, not as document snapshots. A page of handwriting
 * is easily a few hundred kilobytes of points; snapshotting it per stroke
 * would blow past the in-memory blob ceiling in the repository standard within
 * a paragraph. An edit records only the strokes added or removed, so the cost
 * of history is proportional to what changed.
 *
 * The model holds no DOM and does no rendering, so it is testable without a
 * browser and reusable by a non-canvas surface.
 */

import type { InkCanvasSize, InkDocument, InkStroke } from './schema';
import { INK_SCHEMA_VERSION, createInkDocument } from './schema';
import { findStrokeAtPoint } from './geometry';

/**
 * One reversible change.
 *
 * `at` is the index the strokes occupied, so an undone erase puts the ink back
 * where it was in the draw order rather than on top of everything else.
 */
interface InkEdit {
	readonly added: readonly {
		readonly index: number;
		readonly stroke: InkStroke;
	}[];
	readonly removed: readonly {
		readonly index: number;
		readonly stroke: InkStroke;
	}[];
}

/**
 * How many edits are retained.
 *
 * Bounded because an unbounded stack is an unbounded memory leak in a session
 * that may last a whole school day on a low-memory phone.
 */
export const MAX_HISTORY_ENTRIES = 100;

/** Something that observes model changes. */
export type InkModelListener = (document: InkDocument) => void;

/**
 * An ink document plus the edit history over it.
 *
 * Every mutating method returns whether it changed anything, so a caller can
 * avoid a needless re-render and a needless history entry.
 */
export class InkDocumentModel {
	private current: InkDocument;

	private readonly undoStack: InkEdit[] = [];

	private readonly redoStack: InkEdit[] = [];

	private selectedIds: readonly string[] = [];

	private readonly listeners = new Set<InkModelListener>();

	private readonly now: () => Date;

	/**
	 * @param document Starting document.
	 * @param now      Injected clock, so tests are deterministic.
	 */
	public constructor(
		document: InkDocument,
		now: () => Date = () => new Date()
	) {
		this.current = document;
		this.now = now;
	}

	/**
	 * Creates a model over a fresh, empty document.
	 *
	 * @param canvas Surface size.
	 * @param now    Injected clock.
	 * @return The model.
	 */
	public static empty(
		canvas: InkCanvasSize,
		now: () => Date = () => new Date()
	): InkDocumentModel {
		return new InkDocumentModel(createInkDocument(canvas, now), now);
	}

	/** The current document. Treated as immutable by callers. */
	public get document(): InkDocument {
		return this.current;
	}

	/** Identifiers of the currently selected strokes. */
	public get selection(): readonly string[] {
		return this.selectedIds;
	}

	public get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	public get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/** Whether the document currently holds any ink. */
	public get isEmpty(): boolean {
		return this.current.strokes.length === 0;
	}

	/**
	 * Subscribes to document changes.
	 *
	 * @param listener Receives the document after every accepted change.
	 * @return An unsubscribe function.
	 */
	public subscribe(listener: InkModelListener): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Appends a completed stroke.
	 *
	 * @param stroke Stroke to add.
	 * @return True when the stroke was added.
	 */
	public addStroke(stroke: InkStroke): boolean {
		if (stroke.points.length === 0) {
			return false;
		}

		const index = this.current.strokes.length;
		const edit = { added: [{ index, stroke }], removed: [] };

		// Order matters: history is recorded BEFORE listeners are told. A
		// listener that reads `canUndo` during the notification — which the
		// React binding does, to enable its Undo button — would otherwise see
		// the state from before this edit, leaving Undo disabled after the
		// writer's very first stroke.
		this.apply(edit);
		this.pushUndo(edit);
		this.emit();

		return true;
	}

	/**
	 * Removes strokes by identifier.
	 *
	 * @param ids Identifiers to remove.
	 * @return True when at least one stroke was removed.
	 */
	public removeStrokes(ids: readonly string[]): boolean {
		const wanted = new Set(ids);
		const removed = this.current.strokes
			.map((stroke, index) => ({ index, stroke }))
			.filter((entry) => wanted.has(entry.stroke.id));

		if (removed.length === 0) {
			return false;
		}

		const edit = { added: [], removed };

		// History before notification, as in `addStroke`. The selection is
		// narrowed by direct assignment rather than through `setSelection`,
		// which only emits when the selection actually changed — routing the
		// removal's notification through it meant a removal with nothing
		// selected notified nobody at all.
		this.apply(edit);
		this.pushUndo(edit);
		this.selectedIds = this.selectedIds.filter((id) => !wanted.has(id));
		this.emit();

		return true;
	}

	/**
	 * Removes the topmost stroke under a point. This is the eraser.
	 *
	 * @param x           Point x, in canvas coordinates.
	 * @param y           Point y, in canvas coordinates.
	 * @param tolerancePx Eraser radius in CSS pixels.
	 * @return The identifier erased, or null when nothing was under the point.
	 */
	public eraseAt(x: number, y: number, tolerancePx: number): string | null {
		const hit = findStrokeAtPoint(this.current.strokes, x, y, tolerancePx);

		if (hit === null) {
			return null;
		}

		return this.removeStrokes([hit.id]) ? hit.id : null;
	}

	/**
	 * Selects the topmost stroke under a point.
	 *
	 * @param x           Point x.
	 * @param y           Point y.
	 * @param tolerancePx Hit tolerance in CSS pixels.
	 * @param additive    Add to the selection rather than replacing it.
	 * @return The identifier selected, or null when the point was blank.
	 */
	public selectAt(
		x: number,
		y: number,
		tolerancePx: number,
		additive = false
	): string | null {
		const hit = findStrokeAtPoint(this.current.strokes, x, y, tolerancePx);

		if (hit === null) {
			if (!additive) {
				this.setSelection([]);
			}

			return null;
		}

		if (!additive) {
			this.setSelection([hit.id]);

			return hit.id;
		}

		this.setSelection(
			this.selectedIds.includes(hit.id)
				? this.selectedIds.filter((id) => id !== hit.id)
				: [...this.selectedIds, hit.id]
		);

		return hit.id;
	}

	/**
	 * Replaces the selection.
	 *
	 * Identifiers that name no stroke are dropped rather than retained, so the
	 * selection can never outlive the ink it points at.
	 *
	 * @param ids Identifiers to select.
	 */
	public setSelection(ids: readonly string[]): void {
		const present = new Set(this.current.strokes.map((stroke) => stroke.id));
		const next = ids.filter((id) => present.has(id));
		const changed =
			next.length !== this.selectedIds.length ||
			next.some((id, index) => this.selectedIds[index] !== id);

		if (!changed) {
			return;
		}

		this.selectedIds = next;
		this.emit();
	}

	/**
	 * Deletes the selected strokes.
	 *
	 * @return True when anything was deleted.
	 */
	public deleteSelection(): boolean {
		return this.removeStrokes(this.selectedIds);
	}

	/**
	 * Removes every stroke.
	 *
	 * Undoable, deliberately: a confirmation dialog stops an accidental clear,
	 * and undo stops a confirmed one the writer regrets.
	 *
	 * @return True when there was anything to clear.
	 */
	public clear(): boolean {
		return this.removeStrokes(this.current.strokes.map((stroke) => stroke.id));
	}

	/**
	 * Reverses the last edit.
	 *
	 * @return True when an edit was undone.
	 */
	public undo(): boolean {
		const edit = this.undoStack.pop();

		if (edit === undefined) {
			return false;
		}

		this.apply({ added: edit.removed, removed: edit.added });
		this.redoStack.push(edit);
		this.emit();

		return true;
	}

	/**
	 * Reapplies the last undone edit.
	 *
	 * @return True when an edit was redone.
	 */
	public redo(): boolean {
		const edit = this.redoStack.pop();

		if (edit === undefined) {
			return false;
		}

		this.apply(edit);
		this.undoStack.push(edit);
		this.emit();

		return true;
	}

	/**
	 * Records the surface size the writer is now drawing on.
	 *
	 * Captured coordinates are NOT rewritten. The renderer scales them at draw
	 * time instead, so a resize can never accumulate rounding error into the
	 * writer's handwriting, and reopening at the original size is lossless.
	 *
	 * @param canvas New surface size.
	 * @return True when the recorded size changed.
	 */
	public setCanvasSize(canvas: InkCanvasSize): boolean {
		const previous = this.current.canvas;

		if (
			previous.widthPx === canvas.widthPx &&
			previous.heightPx === canvas.heightPx &&
			previous.dpr === canvas.dpr
		) {
			return false;
		}

		this.current = { ...this.current, canvas };
		this.emit();

		return true;
	}

	/**
	 * Replaces the whole document, e.g. after reopening a saved one.
	 *
	 * History is discarded rather than carried across: an undo that reached
	 * back into a different document would resurrect strokes the writer never
	 * put on this page.
	 *
	 * @param document Document to adopt.
	 */
	public restore(document: InkDocument): void {
		this.current = document;
		this.undoStack.length = 0;
		this.redoStack.length = 0;
		this.selectedIds = [];
		this.emit();
	}

	/**
	 * Applies an edit to the document.
	 *
	 * Deliberately does NOT notify: every caller records history first and
	 * emits once afterwards, so a listener never observes a document whose
	 * undo/redo stacks disagree with its strokes.
	 *
	 * @param edit Edit to apply.
	 */
	private apply(edit: InkEdit): void {
		const removing = new Set(edit.removed.map((entry) => entry.stroke.id));
		let strokes = this.current.strokes.filter(
			(stroke) => !removing.has(stroke.id)
		);

		// Re-insert additions at their recorded indices, ascending, so that
		// each index is interpreted against the array it was measured on.
		for (const entry of [...edit.added].sort((a, b) => a.index - b.index)) {
			const at = Math.min(Math.max(entry.index, 0), strokes.length);

			strokes = [...strokes.slice(0, at), entry.stroke, ...strokes.slice(at)];
		}

		this.current = {
			...this.current,
			schemaVersion: INK_SCHEMA_VERSION,
			strokes,
			updatedAt: this.now().toISOString(),
		};
	}

	/**
	 * Records an edit for undo and invalidates the redo branch.
	 *
	 * @param edit Edit that was just applied.
	 */
	private pushUndo(edit: InkEdit): void {
		this.undoStack.push(edit);
		this.redoStack.length = 0;

		if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
			this.undoStack.shift();
		}
	}

	/** Notifies listeners. A throwing listener must not break the model. */
	private emit(): void {
		for (const listener of this.listeners) {
			try {
				listener(this.current);
			} catch {
				// A consumer's render error must not stop the writer drawing.
			}
		}
	}
}
