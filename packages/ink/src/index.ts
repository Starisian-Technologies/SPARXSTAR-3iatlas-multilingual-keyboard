/**
 * Digital-ink capture for the 3iAtlas Input Toolkit.
 *
 * Nothing in this package makes a network request. Handwriting is captured,
 * edited, serialized, and rendered entirely on the device, which is what keeps
 * writing available with no connectivity at all (specification section 9) and
 * what keeps the writer's content inside the product (section 10).
 *
 * Recognition lives in `@starisian/3iatlas-input-recognition` behind a
 * provider-neutral port, so this package never learns that a recognizer
 * exists.
 */

export type {
	InkCanvasSize,
	InkDocument,
	InkPoint,
	InkPointerType,
	InkStroke,
	InkToolType,
} from './schema';
export {
	INK_SCHEMA_VERSION,
	NO_PRESSURE,
	createInkDocument,
	createInkId,
	hasPressureData,
} from './schema';

export type { InkParseIssue, InkParseResult } from './serialize';
export { parseInkDocument, serializeInkDocument } from './serialize';

export type { InkBounds } from './geometry';
export {
	documentBounds,
	findStrokeAtPoint,
	strokeBounds,
	strokeContainsPoint,
} from './geometry';

export type { InkModelListener } from './model';
export { InkDocumentModel, MAX_HISTORY_ENTRIES } from './model';

export type {
	InkCanvasRenderOptions,
	InkSvgOptions,
	InkToolPreset,
} from './render';
export {
	DEFAULT_TOOL_PRESETS,
	inkDocumentToSvg,
	outlineToPathData,
	renderInkToCanvas,
	strokeOutline,
	strokePathData,
} from './render';

export type {
	PalmRejectionOptions,
	PalmRejectionState,
	PointerAdmission,
	PointerRejection,
	PointerSample,
} from './pointer';
export {
	PALM_CONTACT_SIZE_PX,
	PEN_PRIORITY_WINDOW_MS,
	admitPointerSample,
	advancePalmRejection,
	toInkPointerType,
} from './pointer';

export type { InkMode, InkSurface, InkSurfaceOptions } from './surface';
export { MAX_PNG_BLOB_BYTES, mountInkSurface } from './surface';

export type {
	InkTranscription,
	TranscriptionInput,
	TranscriptionSource,
} from './transcription';
export {
	TRANSCRIPTION_SCHEMA_VERSION,
	createInkTranscription,
	isTranscriptionIntact,
} from './transcription';
