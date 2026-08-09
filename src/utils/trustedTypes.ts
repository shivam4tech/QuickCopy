/**
 * Pages with a Trusted Types policy flag `new Worker(string)` as a script-sink
 * violation: report-only policies spam the console with CSP messages, and
 * enforce-mode policies would block the in-page OCR worker entirely.
 *
 * Wrapping the isolated-world Worker constructor so script URLs are passed as
 * TrustedScriptURL (via a policy) eliminates those reports and lets in-page
 * OCR work even on enforce-mode pages. Policy resolution order:
 *   1. the page's own default policy (no new policy, no CSP violation)
 *   2. a locally-created `quickcopy#worker` policy (allowed unless the page
 *      restricts policy names, e.g. LinkedIn)
 *   3. nothing — worker spawns are blocked by the page's CSP; callers can
 *      check isWorkerSpawnBlockedByTrustedTypes() and use a fallback path.
 */

interface TrustedTypePolicyLike {
  createScriptURL?: (url: string) => string;
}

interface TrustedTypePolicyFactoryLike {
  createPolicy?: (name: string, factory: TrustedTypePolicyLike) => TrustedTypePolicyLike;
  defaultPolicy?: TrustedTypePolicyLike;
}

let workerPolicyBlocked = false;

/** True when the page's CSP allows Trusted Types but no usable policy is obtainable. */
export function isWorkerSpawnBlockedByTrustedTypes(): boolean {
  return workerPolicyBlocked;
}

export function enableTrustedTypesWorkers(): void {
  workerPolicyBlocked = false;

  const tt = (globalThis as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes;
  if (!tt?.createPolicy) return;

  let policy: TrustedTypePolicyLike | null = null;

  if (typeof tt.defaultPolicy?.createScriptURL === 'function') {
    policy = tt.defaultPolicy;
  }

  if (!policy) {
    try {
      policy = tt.createPolicy('quickcopy#worker', {
        createScriptURL: (url: string) => url,
      });
    } catch {
      workerPolicyBlocked = true;
      return;
    }
  }

  const NativeWorker = globalThis.Worker;
  if (!NativeWorker) return;

  const WrappedWorker = new Proxy(NativeWorker, {
    construct(target: typeof Worker, args: unknown[]) {
      const url = args[0];
      const createScriptURL = policy?.createScriptURL;
      if (typeof url === 'string' && createScriptURL) {
        args[0] = createScriptURL(url);
      }
      return Reflect.construct(target, args);
    },
  });

  globalThis.Worker = WrappedWorker as typeof Worker;
}
