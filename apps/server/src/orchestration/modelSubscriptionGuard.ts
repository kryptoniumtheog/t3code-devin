type GuardedModelSelection = {
  readonly instanceId?: string;
  readonly model?: string;
};

type GuardedCommand = {
  readonly type: string;
  readonly modelSelection?: GuardedModelSelection;
};

type GuardEnvironment = Readonly<Record<string, string | undefined>>;

export const OPENCODE_GO_MUSE_LIMITS = Object.freeze({
  fiveHoursUsageUsd: 12,
  weeklyUsageUsd: 30,
  monthlyUsageUsd: 60,
  semantics: "subscription-usage-limit" as const,
});

const ENABLED = "T3_EC_MODEL_GUARD_ROUTE";
const PROVIDER = "T3_EC_MODEL_GUARD_PROVIDER";
const MODEL = "T3_EC_MODEL_GUARD_MODEL";
const PROVEN = "T3_EC_MODEL_GUARD_IDENTITY_PROVEN";
const ELIGIBLE_UNTIL = "T3_EC_MODEL_GUARD_ELIGIBLE_UNTIL";

const guardedCommand = (command: GuardedCommand) =>
  command.type === "thread.create" || command.type === "thread.turn.start";

export function modelSubscriptionGuardFailure(
  command: GuardedCommand,
  environment: GuardEnvironment = process.env,
  now: Date = new Date(),
): string | null {
  const route = environment[ENABLED]?.trim();
  if (!route || !guardedCommand(command)) return null;

  if (route !== "devin-swe2-free" && route !== "opencode-go-muse") {
    return "Model subscription guard rejected an unknown route.";
  }

  const provider = environment[PROVIDER]?.trim();
  const model = environment[MODEL]?.trim();
  if (environment[PROVEN] !== "1" || !provider || !model) {
    return "Model subscription guard rejected an unproved provider/model identity.";
  }

  if (route === "devin-swe2-free") {
    const eligibleUntil = environment[ELIGIBLE_UNTIL]?.trim();
    const deadline = eligibleUntil ? Date.parse(eligibleUntil) : Number.NaN;
    if (!Number.isFinite(deadline) || now.getTime() >= deadline) {
      return "Devin SWE-2 Free eligibility is missing or expired.";
    }
  }

  const selected = command.modelSelection;
  if (!selected?.instanceId || !selected.model) {
    return "Model subscription guard requires an explicit provider and model.";
  }
  if (selected.instanceId !== provider || selected.model !== model) {
    return "Model subscription guard rejected a provider/model mismatch or alias.";
  }

  return null;
}
