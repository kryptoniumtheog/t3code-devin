import { describe, expect, it } from "@effect/vitest";
import {
  ProviderDriverKind,
  ProviderInstanceId,
  type OrchestrationThreadShell,
  type ServerProvider,
} from "@t3tools/contracts";

import { resolveThreadProviderIdentity } from "./providerIdentity.ts";

const provider = (driver: string): ServerProvider =>
  ({
    instanceId: ProviderInstanceId.make(driver),
    driver: ProviderDriverKind.make(driver),
    displayName:
      driver === "opencode" ? "OpenCode" : `${driver[0]!.toUpperCase()}${driver.slice(1)}`,
    models: [],
  }) as unknown as ServerProvider;

const providers = [provider("codex"), provider("devin"), provider("opencode")];

function thread(
  controller: string,
  delegatedDrivers?: ReadonlyArray<string>,
  metadataController = controller,
): Pick<OrchestrationThreadShell, "modelSelection" | "providerIdentity"> {
  return {
    modelSelection: {
      instanceId: ProviderInstanceId.make(controller),
      model: "model",
    },
    ...(delegatedDrivers
      ? {
          providerIdentity: {
            controllerInstanceId: ProviderInstanceId.make(metadataController),
            controllerDriver: ProviderDriverKind.make(metadataController),
            delegatedDrivers: delegatedDrivers.map((driver) => ProviderDriverKind.make(driver)),
          },
        }
      : {}),
  };
}

describe("resolveThreadProviderIdentity", () => {
  it.each([
    ["Codex only", thread("codex", []), "codex", []],
    ["direct Devin", thread("devin", []), "devin", []],
    ["direct OpenCode", thread("opencode", []), "opencode", []],
    ["Codex plus Devin", thread("codex", ["devin"]), "codex", ["devin"]],
    ["Codex plus Muse", thread("codex", ["opencode"]), "codex", ["opencode"]],
    [
      "Codex plus both",
      thread("codex", ["devin", "opencode", "devin"]),
      "codex",
      ["devin", "opencode"],
    ],
  ])("resolves %s", (_label, input, controllerDriver, delegatedDrivers) => {
    const result = resolveThreadProviderIdentity(input, providers);
    expect(result.controller.driverKind).toBe(controllerDriver);
    expect(result.delegatedDrivers).toEqual(delegatedDrivers);
  });

  it("renders an unconfigured controller as neutral instead of Codex", () => {
    const result = resolveThreadProviderIdentity(thread("future-agent", ["devin"]), providers);
    expect(result.controller).toEqual({
      kind: "unknown",
      driverKind: null,
      displayName: "Unknown provider",
    });
    expect(result.delegatedDrivers).toEqual([]);
  });

  it("keeps absent metadata controller-only", () => {
    expect(resolveThreadProviderIdentity(thread("codex"), providers).delegatedDrivers).toEqual([]);
  });

  it("ignores stale metadata from another controller", () => {
    expect(
      resolveThreadProviderIdentity(thread("codex", ["devin"], "opencode"), providers)
        .delegatedDrivers,
    ).toEqual([]);
  });
});
