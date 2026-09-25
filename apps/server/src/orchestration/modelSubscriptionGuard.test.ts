import { describe, expect, it } from "vitest";

import {
  modelSubscriptionGuardFailure,
  OPENCODE_GO_MUSE_LIMITS,
} from "./modelSubscriptionGuard.ts";

const command = (instanceId?: string, model?: string) => ({
  type: "thread.turn.start",
  ...(instanceId || model ? { modelSelection: { instanceId, model } } : {}),
});

const openCode = {
  T3_EC_MODEL_GUARD_ROUTE: "opencode-go-muse",
  T3_EC_MODEL_GUARD_PROVIDER: "opencode",
  T3_EC_MODEL_GUARD_MODEL: "opencode-go/muse-spark-1.3-contributor",
  T3_EC_MODEL_GUARD_IDENTITY_PROVEN: "1",
};

describe("modelSubscriptionGuardFailure", () => {
  it("leaves unguarded installations unchanged", () => {
    expect(modelSubscriptionGuardFailure(command("other", "other"), {})).toBeNull();
  });

  it("accepts only the exact OpenCode Go Muse provider and model", () => {
    expect(
      modelSubscriptionGuardFailure(
        command("opencode", "opencode-go/muse-spark-1.3-contributor"),
        openCode,
      ),
    ).toBeNull();
    expect(modelSubscriptionGuardFailure(command("opencode", "muse-spark-1.3"), openCode)).toMatch(
      /mismatch or alias/,
    );
    expect(
      modelSubscriptionGuardFailure(
        command("openrouter", "opencode-go/muse-spark-1.3-contributor"),
        openCode,
      ),
    ).toMatch(/mismatch or alias/);
    expect(modelSubscriptionGuardFailure(command(), openCode)).toMatch(
      /explicit provider and model/,
    );
  });

  it("fails closed when the provider identity is not proved", () => {
    expect(
      modelSubscriptionGuardFailure(command("devin", "swe-2-high"), {
        T3_EC_MODEL_GUARD_ROUTE: "devin-swe2-free",
        T3_EC_MODEL_GUARD_PROVIDER: "devin",
        T3_EC_MODEL_GUARD_MODEL: "swe-2-high",
        T3_EC_MODEL_GUARD_IDENTITY_PROVEN: "0",
        T3_EC_MODEL_GUARD_ELIGIBLE_UNTIL: "2026-10-11T00:00:00Z",
      }),
    ).toMatch(/unproved/);
  });

  it("rejects an expired Devin eligibility window", () => {
    expect(
      modelSubscriptionGuardFailure(
        command("devin", "provider-proved-swe2-free-id"),
        {
          T3_EC_MODEL_GUARD_ROUTE: "devin-swe2-free",
          T3_EC_MODEL_GUARD_PROVIDER: "devin",
          T3_EC_MODEL_GUARD_MODEL: "provider-proved-swe2-free-id",
          T3_EC_MODEL_GUARD_IDENTITY_PROVEN: "1",
          T3_EC_MODEL_GUARD_ELIGIBLE_UNTIL: "2026-10-11T00:00:00Z",
        },
        new Date("2026-10-11T00:00:00Z"),
      ),
    ).toMatch(/expired/);
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
