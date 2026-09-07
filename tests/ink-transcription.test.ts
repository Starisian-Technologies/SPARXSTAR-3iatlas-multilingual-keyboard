/**
 * The two-record guarantee: ink and confirmed text, linked and both kept.
 *
 * A later recognition model has to be evaluable against real Mandinka
 * handwriting, and that is only possible if the original strokes survive
 * unedited alongside what a person confirmed they say. These tests hold that
 * link in place.
 */

import { describe, expect, it } from '@jest/globals';

import type { InkDocument, InkStroke } from '@starisian/3iatlas-input-ink';
import {
	TRANSCRIPTION_SCHEMA_VERSION,
	InkDocumentModel,
	createInkTranscription,
	isTranscriptionIntact,
} from '@starisian/3iatlas-input-ink';

const CANVAS = { widthPx: 400, heightPx: 200, dpr: 1 } as const;
const CLOCK = (): Date => new Date('2026-09-06T12:00:00.000Z');

/**
 * Builds a stroke.
 *
 * @param id Stroke identifier.
 * @return The stroke.
 */
const stroke = (id: string): InkStroke => ({
	id,
	tool: 'pen',
	pointerType: 'pen',
	color: '#000000',
	sizePx: 3,
	opacity: 1,
	startedAt: 0,
	points: [{ x: 1, y: 1, pressure: 0.5, t: 0 }],
});

/**
 * Builds a document holding the given strokes.
 *
 * @param ids Stroke identifiers.
 * @return The document.
 */
const documentWith = (ids: readonly string[]): InkDocument => {
	const model = InkDocumentModel.empty(CANVAS);

	for (const id of ids) {
		model.addStroke(stroke(id));
	}

	return model.document;
};

describe('transcription records', () => {
	it('keeps the confirmed text exactly as confirmed', () => {
		const transcription = createInkTranscription(
			{
				inkDocumentId: 'ink_1',
				strokeIds: ['s1'],
				text: 'kuŋoo',
				source: 'recognized-candidate',
				lexiconEntryId: 'e1',
				lexiconRevision: 'rev-2',
			},
			CLOCK
		);

		expect(transcription.text).toBe('kuŋoo');
		expect(transcription.schemaVersion).toBe(TRANSCRIPTION_SCHEMA_VERSION);
		expect(transcription.confirmedAt).toBe('2026-09-06T12:00:00.000Z');
	});

	it('mints a distinct identifier per record', () => {
		const input = {
			inkDocumentId: 'ink_1',
			strokeIds: ['s1'],
			text: 'baa',
			source: 'typed' as const,
		};

		expect(createInkTranscription(input, CLOCK).id).not.toBe(
			createInkTranscription(input, CLOCK).id
		);
	});

	it('defaults the lexicon fields to null rather than to a guess', () => {
		const transcription = createInkTranscription(
			{
				inkDocumentId: 'ink_1',
				strokeIds: ['s1'],
				text: 'kuŋooba',
				source: 'not-listed',
			},
			CLOCK
		);

		expect(transcription.lexiconEntryId).toBeNull();
		expect(transcription.lexiconRevision).toBeNull();
	});

	it('copies the stroke list rather than aliasing the caller array', () => {
		const strokeIds = ['s1'];
		const transcription = createInkTranscription(
			{ inkDocumentId: 'ink_1', strokeIds, text: 'baa', source: 'typed' },
			CLOCK
		);

		strokeIds.push('s2');

		expect(transcription.strokeIds).toEqual(['s1']);
	});
});

describe('the link between a reading and its evidence', () => {
	it('holds while every stroke is still present', () => {
		const document = documentWith(['s1', 's2']);
		const transcription = createInkTranscription(
			{
				inkDocumentId: document.id,
				strokeIds: ['s1', 's2'],
				text: 'kuŋo',
				source: 'typed',
			},
			CLOCK
		);

		expect(isTranscriptionIntact(transcription, document)).toBe(true);
	});

	it('is reported as broken once a stroke is erased', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(stroke('s1'));
		model.addStroke(stroke('s2'));

		const transcription = createInkTranscription(
			{
				inkDocumentId: model.document.id,
				strokeIds: ['s1', 's2'],
				text: 'kuŋo',
				source: 'typed',
			},
			CLOCK
		);

		model.removeStrokes(['s2']);

		// The reading survives; its evidence does not. A consumer has to be
		// able to see that rather than present the text as still backed by
		// handwriting.
		expect(isTranscriptionIntact(transcription, model.document)).toBe(false);
	});

	it('is reported as broken against a different document', () => {
		const transcription = createInkTranscription(
			{
				inkDocumentId: 'ink_other',
				strokeIds: ['s1'],
				text: 'kuŋo',
				source: 'typed',
			},
			CLOCK
		);

		expect(isTranscriptionIntact(transcription, documentWith(['s1']))).toBe(
			false
		);
	});

	it('survives an undo that puts the strokes back', () => {
		const model = InkDocumentModel.empty(CANVAS);

		model.addStroke(stroke('s1'));

		const transcription = createInkTranscription(
			{
				inkDocumentId: model.document.id,
				strokeIds: ['s1'],
				text: 'kuŋo',
				source: 'typed',
			},
			CLOCK
		);

		model.removeStrokes(['s1']);

		expect(isTranscriptionIntact(transcription, model.document)).toBe(false);

		model.undo();

		expect(isTranscriptionIntact(transcription, model.document)).toBe(true);
	});
});
