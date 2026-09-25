import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  EnvironmentId,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  type ServerConfig,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  createThreadRowProviderInstanceResolver,
  resolveThreadProviderInstance,
} from "./thread-provider-instance";

function makeConfig(
  providers: ReadonlyArray<{
    readonly instanceId: string;
    readonly driver: string;
    readonly displayName?: string;
    readonly accentColor?: string;
  }>,
): ServerConfig {
  return { providers } as unknown as ServerConfig;
}

function makeThread(environmentId: EnvironmentId, instanceId: string): EnvironmentThreadShell {
  return {
    environmentId,
    id: ThreadId.make("thread-1"),
    projectId: ProjectId.make("project-1"),
    title: "Thread",
    modelSelection: { instanceId: ProviderInstanceId.make(instanceId), model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    latestTurn: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    session: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
  } as unknown as EnvironmentThreadShell;
}

describe("resolveThreadProviderInstance", () => {
  it("resolves two environments with the same default instance id independently", () => {
    const environmentA = EnvironmentId.make("environment-a");
    const environmentB = EnvironmentId.make("environment-b");
    const serverConfigs = new Map<EnvironmentId, ServerConfig>([
      [
        environmentA,
        makeConfig([{ instanceId: "codex", driver: "codex", accentColor: "#ff8800" }]),
      ],
      [environmentB, makeConfig([{ instanceId: "codex", driver: "codex" }])],
    ]);

    expect(
      resolveThreadProviderInstance(serverConfigs, makeThread(environmentA, "codex"))?.accentColor,
    ).toBe("#ff8800");
    expect(
      resolveThreadProviderInstance(serverConfigs, makeThread(environmentB, "codex"))?.accentColor,
    ).toBeUndefined();
  });

  it("labels a custom instance by its id so its initials differ from the default", () => {
    const environmentId = EnvironmentId.make("environment-a");
    const serverConfigs = new Map<EnvironmentId, ServerConfig>([
      [
        environmentId,
        makeConfig([
          { instanceId: "codex", driver: "codex", displayName: "Codex" },
          { instanceId: "codex_personal", driver: "codex", displayName: "Codex" },
        ]),
      ],
    ]);

    expect(
      resolveThreadProviderInstance(serverConfigs, makeThread(environmentId, "codex"))?.displayName,
    ).toBe("Codex");
    expect(
      resolveThreadProviderInstance(serverConfigs, makeThread(environmentId, "codex_personal"))
        ?.displayName,
    ).toBe("Codex Personal");
  });

  it("hides the badge for a single instance with no accent color", () => {
    const environmentId = EnvironmentId.make("environment-a");
    const serverConfigs = new Map<EnvironmentId, ServerConfig>([
      [environmentId, makeConfig([{ instanceId: "codex", driver: "codex" }])],
    ]);
    expect(
      resolveThreadProviderInstance(serverConfigs, makeThread(environmentId, "codex"))?.showBadge,
    ).toBe(false);
  });

  it("keeps the model-selected controller when the live session is delegated", () => {
    const environmentId = EnvironmentId.make("environment-a");
    const serverConfigs = new Map<EnvironmentId, ServerConfig>([
      [environmentId, makeConfig([{ instanceId: "codex", driver: "codex" }])],
    ]);
    const thread = {
      ...makeThread(environmentId, "codex"),
      session: { providerInstanceId: ProviderInstanceId.make("devin") },
      providerIdentity: {
        controllerInstanceId: ProviderInstanceId.make("codex"),
        controllerDriver: ProviderDriverKind.make("codex"),
        delegatedDrivers: [ProviderDriverKind.make("devin")],
      },
    } as unknown as EnvironmentThreadShell;

    expect(resolveThreadProviderInstance(serverConfigs, thread)).toMatchObject({
      driverKind: "codex",
      delegatedDrivers: ["devin"],
    });
  });

  it("uses a neutral identity for an unconfigured controller", () => {
    const environmentId = EnvironmentId.make("environment-a");
    const serverConfigs = new Map<EnvironmentId, ServerConfig>([
      [environmentId, makeConfig([{ instanceId: "codex", driver: "codex" }])],
    ]);
    expect(
      resolveThreadProviderInstance(serverConfigs, makeThread(environmentId, "ghost")),
    ).toEqual({
      driverKind: null,
      displayName: "Unknown provider",
      showBadge: false,
      delegatedDrivers: [],
    });
  });
});

describe("createThreadRowProviderInstanceResolver", () => {
  const environmentId = EnvironmentId.make("environment-a");
  const serverConfigs = new Map<EnvironmentId, ServerConfig>([
    [
      environmentId,
      makeConfig([
        { instanceId: "codex", driver: "codex", displayName: "Codex" },
        { instanceId: "codex_work", driver: "codex", displayName: "Codex" },
      ]),
    ],
  ]);

  it("hands out the same reference for repeated lookups of one instance", () => {
    const resolve = createThreadRowProviderInstanceResolver(serverConfigs);
    const first = resolve(makeThread(environmentId, "codex"));
    const second = resolve(makeThread(environmentId, "codex"));
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it("distinguishes instances of the same driver", () => {
    const resolve = createThreadRowProviderInstanceResolver(serverConfigs);
    const personal = resolve(makeThread(environmentId, "codex"));
    const work = resolve(makeThread(environmentId, "codex_work"));
    expect(personal).not.toBeNull();
    expect(work).not.toBeNull();
    expect(work).not.toBe(personal);
    expect(work?.displayName).toBe("Codex Work");
  });

  it("hands out a new identity when the server-config generation changes", () => {
    const before = createThreadRowProviderInstanceResolver(serverConfigs);
    const nextConfigs = new Map<EnvironmentId, ServerConfig>([
      [environmentId, makeConfig([{ instanceId: "codex", driver: "codex" }])],
    ]);
    const after = createThreadRowProviderInstanceResolver(nextConfigs);
    expect(after(makeThread(environmentId, "codex"))).not.toBe(
      before(makeThread(environmentId, "codex")),
    );
  });

  it("memoizes neutral identities for unknown instances", () => {
    const resolve = createThreadRowProviderInstanceResolver(serverConfigs);
    const first = resolve(makeThread(environmentId, "ghost"));
    expect(first).toMatchObject({ driverKind: null, displayName: "Unknown provider" });
    expect(resolve(makeThread(environmentId, "ghost"))).toBe(first);
  });
});
