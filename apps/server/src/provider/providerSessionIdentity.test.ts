import { describe, expect, it } from "vitest";
import { resolveProviderSessionIdentity } from "./providerSessionIdentity.ts";

describe("resolveProviderSessionIdentity", () => {
  it("returns the distinct native Codex session id", () => {
    expect(
      resolveProviderSessionIdentity({
        provider: "codex",
        resumeCursor: { threadId: "provider-session-7" },
      }),
    ).toEqual({ ok: true, providerSessionId: "provider-session-7" });
  });

  it("fails closed for missing, malformed, and lookalike Codex cursors", () => {
    for (const resumeCursor of [null, {}, { sessionId: "not-the-codex-contract" }, []]) {
      expect(resolveProviderSessionIdentity({ provider: "codex", resumeCursor })).toEqual({
        ok: false,
        reason: "provider-session-unavailable",
      });
    }
  });

  it("does not infer another provider's identity contract", () => {
    expect(
      resolveProviderSessionIdentity({
        provider: "claudeAgent",
        resumeCursor: { threadId: "lookalike" },
      }),
    ).toEqual({ ok: false, reason: "provider-session-unsupported" });
  });
});
