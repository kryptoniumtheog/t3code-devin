import { describe, expect, it } from "@effect/vitest";
import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";

import type { ProviderInstanceEntry } from "../providerInstances";
import { resolveWebThreadProviderIdentity } from "./threadProviderIdentity";

const codex = {
  instanceId: ProviderInstanceId.make("codex"),
  driverKind: ProviderDriverKind.make("codex"),
  displayName: "Codex",
  models: [],
} as unknown as ProviderInstanceEntry;

describe("resolveWebThreadProviderIdentity", () => {
  it("keeps Codex primary while exposing both durable delegates", () => {
    const result = resolveWebThreadProviderIdentity(
      {
        modelSelection: { instanceId: codex.instanceId, model: "gpt-5.6-sol" },
        providerIdentity: {
          controllerInstanceId: codex.instanceId,
          controllerDriver: codex.driverKind,
          delegatedDrivers: [ProviderDriverKind.make("devin"), ProviderDriverKind.make("opencode")],
        },
      },
      [codex],
    );
    expect(result.driverKind).toBe("codex");
    expect(result.delegatedDrivers).toEqual(["devin", "opencode"]);
  });

  it("uses the neutral unknown state when the controller is not configured", () => {
    const result = resolveWebThreadProviderIdentity(
      {
        modelSelection: {
          instanceId: ProviderInstanceId.make("future-agent"),
          model: "future-model",
        },
      },
      [codex],
    );
    expect(result).toMatchObject({
      controller: undefined,
      driverKind: null,
      displayName: "Unknown provider",
      delegatedDrivers: [],
    });
  });
});
