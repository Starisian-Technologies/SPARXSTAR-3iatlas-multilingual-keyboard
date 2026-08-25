/**
 * Host element for the optional KeymanWeb keyboard.
 *
 * Specification section 5.4 requires failure to fall back to Helper mode, and
 * section 16 gate 7 makes that non-negotiable: neither package failure nor
 * Keyman failure may block ordinary typing. Section 6.4 requires a clear route
 * back to Standard or Helper, the active layout name, first-use guidance, and
 * an explanation that the layout may differ from the device keyboard.
 *
 * Mounting this component is what loads the engine. Helper mode never renders
 * it, which is how section 9's "Helper mode must not load the Keyman engine"
 * requirement is met.
 */

import { useEffect, useRef, useState } from 'react';

import type {
	KeymanAdapter,
	KeymanAssetSource,
	KeymanFailureReason,
} from '@starisian/3iatlas-multilingual-input-keyman';
import { checkKeymanEligibility } from '@starisian/3iatlas-multilingual-input-keyman';

import { useMultilingualInput } from './context';

/** Props accepted by {@link KeymanKeyboardHost}. */
export interface KeymanKeyboardHostProps {
	readonly adapter: KeymanAdapter;
	readonly assetSource: KeymanAssetSource;
	/** Localized explanation shown on first use (section 6.4). */
	readonly guidance: string;
	/** Builds a localized message for a failure reason. */
	readonly describeFailure: (reason: KeymanFailureReason) => string;
	/** Invoked when the host gives up and the consumer must fall back. */
	readonly onFallback: (reason: KeymanFailureReason) => void;
}

/**
 * Mounts the Keyman engine for the active profile.
 *
 * @param props Host configuration.
 * @return The host element, or the failure notice.
 */
export const KeymanKeyboardHost = ({
	adapter,
	assetSource,
	guidance,
	describeFailure,
	onFallback,
}: KeymanKeyboardHostProps): JSX.Element | null => {
	const { activeProfile, emitEvent } = useMultilingualInput();
	const [failure, setFailure] = useState<KeymanFailureReason | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (activeProfile === null) {
			return undefined;
		}

		let cancelled = false;

		const fail = (reason: KeymanFailureReason): void => {
			if (cancelled) {
				return;
			}

			setFailure(reason);
			// Report through the shared event channel as well, so the
			// documented `keyman-fallback` event is actually emitted.
			emitEvent({ type: 'keyman-fallback', reason });
			onFallback(reason);
		};

		// Refuse an unapproved profile before fetching any asset.
		const ineligible = checkKeymanEligibility(activeProfile);

		if (ineligible !== null) {
			fail(ineligible);

			return undefined;
		}

		void (async () => {
			try {
				const ready = await adapter.initialize(assetSource);

				if (!ready) {
					fail('engine-unavailable');

					return;
				}

				const activation = await adapter.activateProfile(activeProfile);

				if (!activation.ok) {
					fail(activation.reason);

					return;
				}

				if (!cancelled) {
					setFailure(null);
				}
			} catch {
				fail('asset-load-failed');
			}
		})();

		return () => {
			cancelled = true;
			void adapter.teardown();
		};
	}, [adapter, assetSource, activeProfile, onFallback, emitEvent]);

	if (activeProfile === null) {
		return null;
	}

	if (failure !== null) {
		return (
			<div className="tiatlas-keyman-host" role="status">
				{describeFailure(failure)}
			</div>
		);
	}

	return (
		<div className="tiatlas-keyman-host">
			<p className="tiatlas-keyman-host__guidance">{guidance}</p>
			<div
				ref={containerRef}
				className="tiatlas-keyman-host__surface"
				lang={activeProfile.bcp47Tag}
				dir={activeProfile.direction}
			/>
		</div>
	);
};
