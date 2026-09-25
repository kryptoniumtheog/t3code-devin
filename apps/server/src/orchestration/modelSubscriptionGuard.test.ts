import { describe, expect, it } from "vite-plus/test";

import {
  isDevinEligibilityExpired,
  modelSubscriptionGuardFailure,
  OPENCODE_GO_MUSE_LIMITS,
} from "./modelSubscriptionGuard.ts";

const command = (instanceId?: string, model?: string) => ({
  type: "thread.turn.start",
  ...(instanceId !== undefined && model !== undefined
    ? { modelSelection: { instanceId, model } }
    : {}),
});

const openCode = {
  T3_EC_MODEL_GUARD_ROUTE: "opencode-go-muse",
};

describe("modelSubscriptionGuardFailure", () => {
  it("leaves unguarded installations unchanged", () => {
    expect(modelSubscriptionGuardFailure(command("other", "other"), {}, 0)).toBeNull();
  });

  it("accepts only the exact OpenCode Go Muse provider and model", () => {
    expect(
      modelSubscriptionGuardFailure(
        command("opencode", "opencode-go/muse-spark-1.3-contributor"),
        openCode,
        0,
      ),
    ).toBeNull();
    expect(
      modelSubscriptionGuardFailure(command("opencode", "muse-spark-1.3"), openCode, 0),
    ).toMatch(/mismatch or alias/);
    expect(
      modelSubscriptionGuardFailure(
        command("openrouter", "opencode-go/muse-spark-1.3-contributor"),
        openCode,
        0,
      ),
    ).toMatch(/mismatch or alias/);
    expect(modelSubscriptionGuardFailure(command(), openCode, 0)).toMatch(
      /explicit provider and model/,
    );
  });

  it("fails closed when the provider identity is not proved", () => {
    expect(
      modelSubscriptionGuardFailure(
        command("devin", "swe-2-high"),
        {
          T3_EC_MODEL_GUARD_ROUTE: "devin-swe2-free",
        },
        0,
      ),
    ).toMatch(/unproved/);
  });

  it("cannot be enabled by substituting a configured Devin alias", () => {
    expect(
      modelSubscriptionGuardFailure(
        command("devin", "swe-2-medium"),
        {
          T3_EC_MODEL_GUARD_ROUTE: "devin-swe2-free",
          T3_EC_MODEL_GUARD_PROVIDER: "devin",
          T3_EC_MODEL_GUARD_MODEL: "swe-2-medium",
          T3_EC_MODEL_GUARD_IDENTITY_PROVEN: "1",
        },
        0,
      ),
    ).toMatch(/unproved/);
  });

  it("holds Devin no later than 2026-10-11 UTC", () => {
    expect(isDevinEligibilityExpired(1_791_676_799_999)).toBe(false);
    expect(isDevinEligibilityExpired(1_791_676_800_000)).toBe(true);
  });

  it("records Go limits as usage limits rather than wallet cash", () => {
    expect(OPENCODE_GO_MUSE_LIMITS).toEqual({
      fiveHoursUsageUsd: 12,
      weeklyUsageUsd: 30,
      monthlyUsageUsd: 60,
      semantics: "subscription-usage-limit",
    });
  });
});
