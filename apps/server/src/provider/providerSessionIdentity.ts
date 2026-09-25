import type { ProviderDriverKind } from "@t3tools/contracts";

export type ProviderSessionIdentityResolution =
  | { readonly ok: true; readonly providerSessionId: string }
  | {
      readonly ok: false;
      readonly reason: "provider-session-unavailable" | "provider-session-unsupported";
    };

/**
 * Resolve only provider cursors whose native session identity has an explicit,
 * stable contract. Opaque cursors and lookalike fields fail closed.
 */
export function resolveProviderSessionIdentity(input: {
  readonly provider: ProviderDriverKind;
  readonly resumeCursor?: unknown | null;
}): ProviderSessionIdentityResolution {
  if (input.provider !== "codex") {
    return { ok: false, reason: "provider-session-unsupported" };
  }

  const cursor = input.resumeCursor;
  if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
    return { ok: false, reason: "provider-session-unavailable" };
  }

  const providerSessionId = (cursor as Record<string, unknown>).threadId;
  if (typeof providerSessionId !== "string" || providerSessionId.trim().length === 0) {
    return { ok: false, reason: "provider-session-unavailable" };
  }
  return { ok: true, providerSessionId };
}
