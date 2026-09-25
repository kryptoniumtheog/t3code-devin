import { describe, expect, it } from "vite-plus/test";

import {
  isDevinEligibilityExpired,
  modelSubscriptionGuardFailure,
  modelSubscriptionReceiptFailure,
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

const devin = {
  T3_EC_MODEL_GUARD_ROUTE: "devin-swe2-free",
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

  it("accepts only the exact account-proved Devin provider and model", () => {
    expect(modelSubscriptionGuardFailure(command("devin", "swe-2-high"), devin, 0)).toBeNull();

    for (const model of ["swe-2-medium", "swe-2-max", "adaptive", "swe-2", "SWE-2 High"]) {
      expect(modelSubscriptionGuardFailure(command("devin", model), devin, 0)).toMatch(
        /mismatch or alias/,
      );
    }
    expect(modelSubscriptionGuardFailure(command("other", "swe-2-high"), devin, 0)).toMatch(
      /mismatch or alias/,
    );
    expect(modelSubscriptionGuardFailure(command(), devin, 0)).toMatch(
      /explicit provider and model/,
    );
  });

  it("cannot be widened by configured aliases or proof labels", () => {
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
    ).toMatch(/mismatch or alias/);
  });

  it("rejects an unknown guard route", () => {
    expect(
      modelSubscriptionGuardFailure(
        command("devin", "swe-2-high"),
        { T3_EC_MODEL_GUARD_ROUTE: "unknown" },
        0,
      ),
    ).toMatch(/unknown route/);
  });

  it("requires the post-selection receipt to match exactly", () => {
    const requested = { instanceId: "devin", model: "swe-2-high" };
    expect(
      modelSubscriptionReceiptFailure(
        requested,
        { instanceId: "devin", model: "swe-2-high" },
        devin,
        0,
      ),
    ).toBeNull();
    expect(modelSubscriptionReceiptFailure(requested, undefined, devin, 0)).toMatch(
      /requires an observed provider and model/,
    );
    expect(
      modelSubscriptionReceiptFailure(
        requested,
        { instanceId: "devin", model: "swe-2-medium" },
        devin,
        0,
      ),
    ).toMatch(/observed provider\/model mismatch/);
    expect(
      modelSubscriptionReceiptFailure(
        requested,
        { instanceId: "other", model: "swe-2-high" },
        devin,
        0,
      ),
    ).toMatch(/observed provider\/model mismatch/);
  });

  it("does not accept a fallback receipt for a rejected request", () => {
    expect(
      modelSubscriptionReceiptFailure(
        { instanceId: "devin", model: "swe-2-max" },
        { instanceId: "devin", model: "swe-2-high" },
        devin,
        0,
      ),
    ).toMatch(/mismatch or alias/);
  });

  it("holds Devin no later than 2026-10-11 UTC", () => {
    expect(isDevinEligibilityExpired(1_791_676_799_999)).toBe(false);
    expect(isDevinEligibilityExpired(1_791_676_800_000)).toBe(true);
    expect(
      modelSubscriptionGuardFailure(command("devin", "swe-2-high"), devin, 1_791_676_800_000),
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
