/**
 * KeymanWeb adapter.
 *
 * Drives the real KeymanWeb browser API. The engine itself is NOT bundled with
 * this package: KeymanWeb is a separately licensed third-party engine, and
 * specification section 16 gate 6 requires its licence to be recorded before
 * its assets ship. Section 10 additionally prohibits loading it from a
 * third-party CDN in production, so this adapter refuses any non-local URL.
 *
 * Deployment therefore means self-hosting a pinned KeymanWeb build and
 * pointing `KeymanAssetSource.baseUrl` at it. See `docs/KEYMAN-DEPLOYMENT.md`.
 */

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';

import type {
	KeymanActivation,
	KeymanAdapter,
	KeymanAssetSource,
	KeymanFailureReason,
} from './index';
import { checkKeymanEligibility } from './index';

/**
 * The subset of the KeymanWeb global API this adapter uses.
 *
 * Declared structurally rather than imported, because the engine is loaded at
 * runtime from a self-hosted script rather than bundled.
 */
export interface KeymanWebGlobal {
	init: (options: Record<string, unknown>) => Promise<void> | void;
	addKeyboards: (...specs: string[]) => Promise<void> | void;
	setActiveKeyboard: (
		keyboardId: string,
		languageCode?: string
	) => Promise<void> | void;
	attachToControl: (element: unknown) => void;
	detachFromControl: (element: unknown) => void;
	shutdown?: () => void;
}

/** How the engine script is obtained and where it attaches. */
export interface KeymanWebOptions {
	/** Element the on-screen keyboard attaches to. */
	readonly target: unknown;
	/**
	 * Loads the engine script and resolves the global.
	 *
	 * Injected so the adapter is testable without a real engine, and so the
	 * host application owns exactly how the script tag is created.
	 */
	readonly loadEngine: (source: KeymanAssetSource) => Promise<KeymanWebGlobal>;
	/** Milliseconds to wait for the engine before failing over to Helper. */
	readonly timeoutMs?: number;
}

/** Default engine load timeout. Failure must be fast, not indefinite. */
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Rejects asset sources that would fetch the engine from a third party.
 *
 * @param baseUrl Configured asset base.
 * @return True when the URL is same-origin or relative.
 */
export const isSelfHostedAssetUrl = (baseUrl: string): boolean => {
	if (baseUrl.startsWith('/')) {
		return true;
	}

	const origin = (globalThis as { location?: { origin?: string } }).location
		?.origin;

	if (typeof origin !== 'string') {
		// Without a known origin, only a relative path can be proven local.
		return false;
	}

	try {
		return new URL(baseUrl, origin).origin === origin;
	} catch {
		return false;
	}
};

/**
 * Races a promise against a timeout.
 *
 * @param work      Promise to bound.
 * @param timeoutMs Milliseconds to allow.
 * @return The resolved value.
 * @throws When the deadline passes first.
 */
const withTimeout = async <T>(
	work: Promise<T>,
	timeoutMs: number
): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | undefined;

	try {
		return await Promise.race([
			work,
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(
					() => reject(new Error('keyman-timeout')),
					timeoutMs
				);
			}),
		]);
	} finally {
		if (timer !== undefined) {
			clearTimeout(timer);
		}
	}
};

/**
 * Real KeymanWeb-backed adapter.
 *
 * Every failure path resolves to a typed reason rather than throwing, so the
 * caller can fall back to Helper mode. Section 16 gate 7: failure here must
 * never block ordinary typing.
 */
export class KeymanWebAdapter implements KeymanAdapter {
	private readonly options: KeymanWebOptions;

	private engine: KeymanWebGlobal | null = null;

	private attached = false;

	private activeKeyboardId: string | null = null;

	public constructor(options: KeymanWebOptions) {
		this.options = options;
	}

	public readonly isAvailable = (): boolean => this.engine !== null;

	/** The keyboard currently activated, for diagnostics (section 13). */
	public readonly getActiveKeyboardId = (): string | null =>
		this.activeKeyboardId;

	public readonly initialize = async (
		source: KeymanAssetSource
	): Promise<boolean> => {
		if (this.engine !== null) {
			return true;
		}

		// Section 10: no third-party CDN in production.
		if (!isSelfHostedAssetUrl(source.baseUrl)) {
			return false;
		}

		try {
			const engine = await withTimeout(
				Promise.resolve(this.options.loadEngine(source)),
				this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
			);

			await engine.init({
				attachType: 'manual',
				root: source.baseUrl,
			});

			this.engine = engine;

			return true;
		} catch {
			this.engine = null;

			return false;
		}
	};

	public readonly activateProfile = async (
		profile: LanguageProfile
	): Promise<KeymanActivation> => {
		const ineligible = checkKeymanEligibility(profile);

		if (ineligible !== null) {
			return { ok: false, reason: ineligible };
		}

		if (this.engine === null) {
			return { ok: false, reason: 'engine-unavailable' };
		}

		const keyboardId = profile.availability.keymanKeyboardId;
		const version = profile.availability.pinnedVersion;

		if (keyboardId === null || version === null) {
			return { ok: false, reason: 'no-approved-keyboard' };
		}

		try {
			// Switching keyboards detaches the previous one first, so two
			// layouts are never live at once (section 6.4).
			if (this.activeKeyboardId !== null) {
				await this.deactivateKeyboard();
			}

			await this.engine.addKeyboards(`${keyboardId}@${version}`);
			await this.engine.setActiveKeyboard(keyboardId, profile.bcp47Tag);

			this.engine.attachToControl(this.options.target);
			this.attached = true;
			this.activeKeyboardId = keyboardId;

			return { ok: true };
		} catch {
			await this.teardown();

			return { ok: false, reason: 'keyboard-activation-failed' };
		}
	};

	public readonly teardown = async (): Promise<void> => {
		try {
			await this.deactivateKeyboard();
			this.engine?.shutdown?.();
		} catch {
			// Teardown must never throw into the host.
		} finally {
			this.engine = null;
			this.activeKeyboardId = null;
			this.attached = false;
		}
	};

	/** Detaches the on-screen keyboard from the target control. */
	private async deactivateKeyboard(): Promise<void> {
		if (this.engine !== null && this.attached) {
			this.engine.detachFromControl(this.options.target);
			this.attached = false;
		}

		this.activeKeyboardId = null;
	}
}

/**
 * Builds a loader that injects a self-hosted KeymanWeb script tag.
 *
 * The default asset path follows KeymanWeb's own layout. Supplying your own
 * loader is supported for bundlers that inline the engine.
 *
 * @param scriptFileName Engine file name under the configured base URL.
 * @return A loader suitable for `KeymanWebOptions.loadEngine`.
 */
export const createScriptTagEngineLoader =
	(scriptFileName = 'keymanweb.js') =>
	async (source: KeymanAssetSource): Promise<KeymanWebGlobal> => {
		const doc = (globalThis as { document?: Document }).document;

		if (doc === undefined) {
			throw new Error('keyman-no-document');
		}

		const existing = (globalThis as { keyman?: KeymanWebGlobal }).keyman;

		if (existing !== undefined) {
			return existing;
		}

		await new Promise<void>((resolve, reject) => {
			const script = doc.createElement('script');

			script.src = `${source.baseUrl.replace(/\/$/, '')}/${scriptFileName}`;
			script.async = true;
			script.addEventListener('load', () => resolve());
			script.addEventListener('error', () =>
				reject(new Error('keyman-script-failed'))
			);
			doc.head.appendChild(script);
		});

		const loaded = (globalThis as { keyman?: KeymanWebGlobal }).keyman;

		if (loaded === undefined) {
			throw new Error('keyman-global-missing');
		}

		return loaded;
	};

/** Failure reasons this adapter can produce, for exhaustive host handling. */
export type KeymanWebFailureReason = KeymanFailureReason;
