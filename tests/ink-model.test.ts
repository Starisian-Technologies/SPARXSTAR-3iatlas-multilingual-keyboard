/**
 * Editing: undo/redo, erasing, selection, clearing, and resize.
 *
 * The behaviors here are the ones a writer notices immediately when they are
 * wrong — an undo that puts a stroke back in the wrong place, an erase that
 * takes the stroke underneath, a resize that shifts the handwriting.
 */

import { describe, expect, it } from '@jest/globals';

import type { InkStroke } from '@starisian/3iatlas-input-ink';
import {
	InkDocumentModel,
	MAX_HISTORY_ENTRIES,
} from '@starisian/3iatlas-input-ink';

const CANVAS = { widthPx: 400, heightPx: 200, dpr: 1 } as const;

/**
 * Builds a straight horizontal stroke at a given height.
 *
 * @param id Stroke identifier.
 * @param y  Vertical position.
 * @return The stroke.
 */
const line = (id: string, y: number): InkStroke => ({
	id,
	tool: 'pen',
	pointerType: 'pen',
	color: '#000000',
	sizePx: 4,
	opacity: 1,
	startedAt: 0,
	points: [
		{ x: 0, y, pressure: 0.5, t: 0 },
		{ x: 100, y, pressure: 0.5, t: 10 },
	],
});

describe('undo and redo', () => {
	it('removes and restores strokes in order', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.addStroke(line('b', 50));

		expect(model.document.strokes).toHaveLength(2);
		expect(model.undo()).toBe(true);
		expect(model.document.strokes.map((s) => s.id)).toEqual(['a']);
		expect(model.redo()).toBe(true);
		expect(model.document.strokes.map((s) => s.id)).toEqual(['a', 'b']);
	});

	it('restores an erased stroke to its original position in the draw order', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.addStroke(line('b', 50));
		model.addStroke(line('c', 90));
		model.removeStrokes(['b']);

		expect(model.document.strokes.map((s) => s.id)).toEqual(['a', 'c']);

		model.undo();

		// Back in the middle, not appended on top. A restored stroke that
		// jumps to the front would draw over ink it used to sit under.
		expect(model.document.strokes.map((s) => s.id)).toEqual(['a', 'b', 'c']);
	});

	it('discards the redo branch once a new stroke is drawn', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.undo();
		model.addStroke(line('b', 50));

		expect(model.canRedo).toBe(false);
	});

	it('reports nothing to undo on an untouched document', () => {
		const model = InkDocumentModel.empty(CANVAS);

		expect(model.canUndo).toBe(false);
		expect(model.undo()).toBe(false);
		expect(model.redo()).toBe(false);
	});

	it('bounds the history rather than growing without limit', () => {
		const model = InkDocumentModel.empty(CANVAS);

		for (let index = 0; index < MAX_HISTORY_ENTRIES + 10; index += 1) {
			model.addStroke(line(`s${index}`, index));
		}

		let undone = 0;

		while (model.undo()) {
			undone += 1;
		}

		expect(undone).toBe(MAX_HISTORY_ENTRIES);
	});
});

describe('erasing and selection', () => {
	it('erases the stroke under the point and leaves the others', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.addStroke(line('b', 50));

		expect(model.eraseAt(50, 50, 4)).toBe('b');
		expect(model.document.strokes.map((s) => s.id)).toEqual(['a']);
	});

	it('erases nothing when the point is on blank canvas', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));

		expect(model.eraseAt(50, 180, 2)).toBeNull();
		expect(model.document.strokes).toHaveLength(1);
	});

	it('takes the most recently drawn stroke when two overlap', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('under', 10));
		model.addStroke(line('over', 10));

		expect(model.eraseAt(50, 10, 2)).toBe('over');
	});

	it('deletes the selection and clears it afterwards', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.addStroke(line('b', 50));
		model.selectAt(50, 50, 4);

		expect(model.selection).toEqual(['b']);
		expect(model.deleteSelection()).toBe(true);
		expect(model.selection).toEqual([]);
		expect(model.document.strokes.map((s) => s.id)).toEqual(['a']);
	});

	it('drops selected identifiers that no longer name a stroke', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.setSelection(['a', 'ghost']);

		expect(model.selection).toEqual(['a']);
	});
});

describe('clearing', () => {
	it('removes every stroke and is undoable', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.addStroke(line('b', 50));

		expect(model.clear()).toBe(true);
		expect(model.isEmpty).toBe(true);

		model.undo();

		expect(model.document.strokes.map((s) => s.id)).toEqual(['a', 'b']);
	});

	it('reports nothing cleared on an already-empty page', () => {
		expect(InkDocumentModel.empty(CANVAS).clear()).toBe(false);
	});
});

describe('resizing', () => {
	it('records the new surface size without rewriting captured points', () => {
		const model = InkDocumentModel.empty(CANVAS);
		const original = line('a', 10);

		model.addStroke(original);
		model.setCanvasSize({ widthPx: 200, heightPx: 100, dpr: 3 });

		expect(model.document.canvas).toEqual({
			widthPx: 200,
			heightPx: 100,
			dpr: 3,
		});
		// The handwriting itself is untouched: a resize must be lossless, so
		// reopening at the original size gives back the original strokes.
		expect(model.document.strokes[0]?.points).toEqual(original.points);
	});

	it('reports no change when the size is the same', () => {
		const model = InkDocumentModel.empty(CANVAS);

		expect(model.setCanvasSize({ ...CANVAS })).toBe(false);
	});
});

describe('restoring a saved document', () => {
	it('discards history so undo cannot reach into the previous page', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));

		const saved = InkDocumentModel.empty(CANVAS);

		saved.addStroke(line('z', 90));
		model.restore(saved.document);

		expect(model.canUndo).toBe(false);
		expect(model.document.strokes.map((s) => s.id)).toEqual(['z']);
	});
});

describe('subscribers see settled state', () => {
	it('reports canUndo to a listener on the very first stroke', () => {
		// Regression: `apply` used to notify before `pushUndo` recorded the
		// edit, so a listener reading `canUndo` during the notification saw
		// the state from before the stroke. The React toolbar does exactly
		// that, which left Undo disabled after a writer's first stroke.
		const model = InkDocumentModel.empty(CANVAS);
		const seen: boolean[] = [];

		model.subscribe(() => seen.push(model.canUndo));
		model.addStroke(line('a', 10));

		expect(seen).toEqual([true]);
	});

	it('reports canRedo to a listener during an undo', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));

		const seen: boolean[] = [];

		model.subscribe(() => seen.push(model.canRedo));
		model.undo();

		expect(seen).toEqual([true]);
	});

	it('notifies on a removal even when nothing was selected', () => {
		// Regression: the removal notification used to be routed through
		// `setSelection`, which emits only when the selection changed. With
		// nothing selected, erasing and clearing told no listener at all, so
		// the UI kept showing ink that was already gone.
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));

		const seen: number[] = [];

		model.subscribe((document) => seen.push(document.strokes.length));

		expect(model.selection).toEqual([]);
		expect(model.removeStrokes(['a'])).toBe(true);
		expect(seen).toEqual([0]);
	});

	it('notifies on a clear with nothing selected', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.addStroke(line('b', 50));

		const seen: number[] = [];

		model.subscribe((document) => seen.push(document.strokes.length));

		expect(model.clear()).toBe(true);
		expect(seen).toEqual([0]);
	});

	it('notifies once for a removal that also narrows the selection', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(line('a', 10));
		model.selectAt(50, 10, 4);

		let notifications = 0;

		model.subscribe(() => {
			notifications += 1;
		});
		model.removeStrokes(['a']);

		expect(notifications).toBe(1);
		expect(model.selection).toEqual([]);
	});
});

describe('subscribers', () => {
	it('keeps working when a listener throws', () => {
		const model = InkDocumentModel.empty(CANVAS);
		const seen: number[] = [];

		model.subscribe(() => {
			throw new Error('consumer render failed');
		});
		model.subscribe((document) => seen.push(document.strokes.length));

		expect(model.addStroke(line('a', 10))).toBe(true);
		expect(seen).toEqual([1]);
	});
});
