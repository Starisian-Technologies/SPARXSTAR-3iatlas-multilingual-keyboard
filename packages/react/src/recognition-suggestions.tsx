/**
 * Suggestion panel: the handwriting beside its proposed readings.
 *
 * Specification-level rules this component exists to enforce visually:
 *
 * - The ink is shown NEXT TO the suggestions, so the writer compares a
 *   proposal against what they actually wrote rather than trusting it.
 * - Nothing is inserted until a person presses a button. There is no
 *   auto-accept, no highest-confidence default, and no timeout that picks one.
 * - A suggestion the approved lexicon does not carry is labelled in TEXT, not
 *   by colour, and is still confirmable. "Not in the dictionary" is not
 *   "wrong".
 * - The writer can always keep their own spelling. That path is a peer of the
 *   suggestions, not a hidden fallback.
 */

import { useState } from 'react';

import type { InkDocument } from '@starisian/3iatlas-input-ink';
import { inkDocumentToSvg } from '@starisian/3iatlas-input-ink';
import type { SuggestionSet } from '@starisian/3iatlas-input-recognition';

/** Localized labels for the suggestion panel. */
export interface RecognitionLabels {
	/** Accessible name for the panel. */
	readonly panel: string;
	/** Accessible description of the rendered handwriting. */
	readonly inkAlt: string;
	readonly heading: string;
	/** Suffix marking a suggestion the approved lexicon does not carry. */
	readonly notInLexicon: string;
	/** Marks a suggestion that IS in the approved lexicon. */
	readonly inLexicon: string;
	readonly useThis: string;
	/** Opens the "my word is not listed" path. */
	readonly notListed: string;
	readonly keepMySpelling: string;
	readonly ownSpellingLabel: string;
	readonly submitForReview: string;
	readonly cancel: string;
	/** Shown when recognition could not run. Keyed by failure reason. */
	readonly unavailable: (reason: string) => string;
	readonly noCandidates: string;
}

/** Props accepted by {@link RecognitionSuggestions}. */
export interface RecognitionSuggestionsProps {
	readonly labels: RecognitionLabels;
	/** The ink the suggestions are about, for the side-by-side rendering. */
	readonly document: InkDocument;
	/** Suggestions to present, or null before any round has run. */
	readonly suggestions: SuggestionSet | null;
	/** The writer chose a suggestion. */
	readonly onConfirmCandidate: (candidateId: string) => void;
	/** The writer supplied their own spelling. */
	readonly onConfirmOwnSpelling: (
		text: string,
		submitForReview: boolean
	) => void;
	readonly className?: string;
}

/**
 * Renders the ink and its proposed readings.
 *
 * @param props Panel configuration.
 * @return The panel, or null before a round has run.
 */
export const RecognitionSuggestions = ({
	labels,
	document,
	suggestions,
	onConfirmCandidate,
	onConfirmOwnSpelling,
	className,
}: RecognitionSuggestionsProps): JSX.Element | null => {
	const [ownSpelling, setOwnSpelling] = useState('');
	const [showingOwnSpelling, setShowingOwnSpelling] = useState(false);

	if (suggestions === null) {
		return null;
	}

	// Rendered from the vector strokes rather than a rasterized snapshot, so
	// the comparison stays crisp on the low-DPI screens this has to work on.
	const svg = inkDocumentToSvg(document, {
		trim: true,
		title: labels.inkAlt,
	});

	return (
		<section
			className={className}
			aria-label={labels.panel}
			data-testid="recognition-panel"
		>
			<div
				className="tiatlas-recognition__ink"
				data-testid="recognition-ink"
				// The SVG is built by this package from local stroke data; no
				// external or user-supplied markup reaches this sink.
				dangerouslySetInnerHTML={{ __html: svg }}
			/>

			<h3>{labels.heading}</h3>

			{suggestions.failure !== null && (
				<p role="status" data-testid="recognition-unavailable">
					{labels.unavailable(suggestions.failure)}
				</p>
			)}

			{suggestions.failure === null && suggestions.candidates.length === 0 && (
				<p role="status">{labels.noCandidates}</p>
			)}

			<ul className="tiatlas-recognition__candidates">
				{suggestions.candidates.map((candidate) => (
					<li key={candidate.id}>
						{/* The proposed text is rendered verbatim — the same code
						    points the recognizer returned. */}
						<span
							className="tiatlas-recognition__text"
							data-testid={`candidate-${candidate.id}`}
						>
							{candidate.text}
						</span>{' '}
						<span className="tiatlas-recognition__status">
							{candidate.inApprovedLexicon
								? labels.inLexicon
								: labels.notInLexicon}
						</span>{' '}
						<button
							type="button"
							onClick={() => onConfirmCandidate(candidate.id)}
						>
							{labels.useThis}
						</button>
					</li>
				))}
			</ul>

			{!showingOwnSpelling && (
				<button
					type="button"
					data-testid="not-listed"
					onClick={() => setShowingOwnSpelling(true)}
				>
					{labels.notListed}
				</button>
			)}

			{showingOwnSpelling && (
				<div className="tiatlas-recognition__own-spelling">
					<label>
						{labels.ownSpellingLabel}{' '}
						<input
							data-testid="own-spelling"
							value={ownSpelling}
							onChange={(event) => setOwnSpelling(event.target.value)}
						/>
					</label>
					<button
						type="button"
						data-testid="keep-my-spelling"
						disabled={ownSpelling === ''}
						onClick={() => onConfirmOwnSpelling(ownSpelling, false)}
					>
						{labels.keepMySpelling}
					</button>
					<button
						type="button"
						data-testid="submit-for-review"
						disabled={ownSpelling === ''}
						onClick={() => onConfirmOwnSpelling(ownSpelling, true)}
					>
						{labels.submitForReview}
					</button>
					<button type="button" onClick={() => setShowingOwnSpelling(false)}>
						{labels.cancel}
					</button>
				</div>
			)}
		</section>
	);
};
