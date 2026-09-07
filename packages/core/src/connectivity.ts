/**
 * Connectivity reporting.
 *
 * The toolkit needs this for one reason only: to tell a writer WHY a
 * suggestion is unavailable, rather than leaving a control that silently does
 * nothing. Writing, editing, saving, and reopening never consult it — they
 * work identically online and off, which is the point.
 *
 * `navigator.onLine` is a weak signal. It reports whether the device has a
 * network interface, not whether anything is reachable across it, so a phone
 * on a captive-portal wifi reports online while nothing resolves. It is used
 * here as a hint for messaging, and never as a gate on the writer's own work.
 */

/** What is known about connectivity right now. */
export interface ConnectivityStatus {
	/**
	 * The browser's own answer, or null when it does not offer one.
	 *
	 * Null rather than `true`: "we do not know" and "we are connected" are
	 * different, and defaulting the unknown case to connected produces a UI
	 * that blames the writer's device for a feature that was never wired up.
	 */
	readonly online: boolean | null;
}

/** Receives connectivity changes. */
export type ConnectivityListener = (status: ConnectivityStatus) => void;

/**
 * Reads connectivity once.
 *
 * @return The current status.
 */
export const readConnectivity = (): ConnectivityStatus => {
	const navigatorApi = (globalThis as { navigator?: { onLine?: unknown } })
		.navigator;

	return {
		online:
			typeof navigatorApi?.onLine === 'boolean' ? navigatorApi.onLine : null,
	};
};

/**
 * Subscribes to connectivity changes.
 *
 * The browser fires `online`/`offline` only on genuine interface transitions,
 * so there is nothing here to throttle: this is not a high-rate event source.
 *
 * @param listener Receives the status on every transition.
 * @return An unsubscribe function. Safe to call more than once.
 */
export const observeConnectivity = (
	listener: ConnectivityListener
): (() => void) => {
	const target = globalThis as {
		addEventListener?: (type: string, handler: () => void) => void;
		removeEventListener?: (type: string, handler: () => void) => void;
	};

	if (
		typeof target.addEventListener !== 'function' ||
		typeof target.removeEventListener !== 'function'
	) {
		return () => undefined;
	}

	const handler = (): void => {
		try {
			listener(readConnectivity());
		} catch {
			// A consumer's handler must not break the writer's session.
		}
	};

	target.addEventListener('online', handler);
	target.addEventListener('offline', handler);

	return () => {
		target.removeEventListener?.('online', handler);
		target.removeEventListener?.('offline', handler);
	};
};
