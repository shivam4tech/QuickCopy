/**
 * Pages with a Trusted Types policy flag `new Worker(string)` as a script-sink
 * violation: report-only policies spam the console with CSP messages, and
 * enforce-mode policies would block the in-page OCR worker entirely.
 *
 * Wrapping the isolated-world Worker constructor so script URLs are passed as
 * TrustedScriptURL (via a locally-created policy) eliminates those reports and
 * lets in-page OCR work even on enforce-mode pages. No-op when the page has no
 * Trusted Types support, and safe when the page restricts policy creation.
 */
export function enableTrustedTypesWorkers(): void {
  try {
    const tt = (globalThis as {
      trustedTypes?: {
        createPolicy?: (name: string, factory: {
          createScriptURL?: (url: string) => string;
        }) => { createScriptURL: (url: string) => unknown };
      };
    }).trustedTypes;

    if (!tt?.createPolicy) return;

    const policy = tt.createPolicy('quickcopy#worker', {
      createScriptURL: (url: string) => url,
    });

    const NativeWorker = globalThis.Worker;
    if (!NativeWorker) return;

    const WrappedWorker = new Proxy(NativeWorker, {
      construct(target: typeof Worker, args: unknown[]) {
        const url = args[0];
        if (typeof url === 'string') {
          args[0] = policy.createScriptURL(url);
        }
        return Reflect.construct(target, args);
      },
    });

    globalThis.Worker = WrappedWorker as typeof Worker;
  } catch {
    // Page restricts policy creation — leave Worker untouched.
  }
}
