type GuardedModelSelection = {
  readonly instanceId?: string | undefined;
  readonly model?: string | undefined;
};

type GuardedCommand = {
  readonly type: string;
  readonly modelSelection?: GuardedModelSelection | null | undefined;
};

type GuardEnvironment = Readonly<Record<string, string | undefined>>;

export const OPENCODE_GO_MUSE_LIMITS = Object.freeze({
  fiveHoursUsageUsd: 12,
  weeklyUsageUsd: 30,
  monthlyUsageUsd: 60,
  semantics: "subscription-usage-limit" as const,
});

const ENABLED = "T3_EC_MODEL_GUARD_ROUTE";
const OPENCODE_PROVIDER = "opencode";
const OPENCODE_MODEL = "opencode-go/muse-spark-1.3-contributor";
const DEVIN_PROVIDER = "devin";
const DEVIN_SWE2_FREE_MODEL: string | null = null;
const DEVIN_ELIGIBLE_UNTIL_EPOCH_MS = 1_791_676_800_000;

export const isDevinEligibilityExpired = (nowEpochMs: number) =>
  nowEpochMs >= DEVIN_ELIGIBLE_UNTIL_EPOCH_MS;

const guardedCommand = (command: GuardedCommand) =>
  command.type === "thread.create" || command.type === "thread.turn.start";

export function modelSubscriptionGuardFailure(
  command: GuardedCommand,
  environment: GuardEnvironment,
  nowEpochMs: number,
): string | null {
  const route = environment[ENABLED]?.trim();
  if (!route || !guardedCommand(command)) return null;

  if (route !== "devin-swe2-free" && route !== "opencode-go-muse") {
    return "Model subscription guard rejected an unknown route.";
  }

  if (route === "devin-swe2-free" && DEVIN_SWE2_FREE_MODEL === null) {
    return "Model subscription guard rejected an unproved provider/model identity.";
  }

  if (route === "devin-swe2-free" && isDevinEligibilityExpired(nowEpochMs)) {
    return "Devin SWE-2 Free eligibility is expired.";
  }

  const selected = command.modelSelection;
  if (!selected?.instanceId || !selected.model) {
    return "Model subscription guard requires an explicit provider and model.";
  }
  const expectedProvider = route === "opencode-go-muse" ? OPENCODE_PROVIDER : DEVIN_PROVIDER;
  const expectedModel = route === "opencode-go-muse" ? OPENCODE_MODEL : DEVIN_SWE2_FREE_MODEL;
  if (selected.instanceId !== expectedProvider || selected.model !== expectedModel) {
    return "Model subscription guard rejected a provider/model mismatch or alias.";
  }

  return null;
}
