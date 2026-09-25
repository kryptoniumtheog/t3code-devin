import {
  PROVIDER_DISPLAY_NAMES,
  type OrchestrationThreadShell,
  type ProviderDriverKind,
  type ServerProvider,
} from "@t3tools/contracts";

import { resolveProviderInstanceDisplayName } from "./providerInstanceDisplay.ts";

export interface ThreadProviderIdentityPresentation {
  readonly controller:
    | {
        readonly kind: "known";
        readonly provider: ServerProvider;
        readonly driverKind: ProviderDriverKind;
        readonly displayName: string;
      }
    | {
        readonly kind: "unknown";
        readonly driverKind: null;
        readonly displayName: "Unknown provider";
      };
  readonly delegatedDrivers: ReadonlyArray<ProviderDriverKind>;
}

/** Delegated OpenCode is the Muse execution lane; direct OpenCode keeps its native name. */
export function delegatedProviderDisplayName(driverKind: ProviderDriverKind): string {
  if (driverKind === "opencode") return "Muse";
  return PROVIDER_DISPLAY_NAMES[driverKind] ?? driverKind;
}

export function resolveCurrentDelegatedProviderDrivers(
  thread: Pick<OrchestrationThreadShell, "modelSelection" | "providerIdentity">,
  controllerDriver: ProviderDriverKind | null,
): ReadonlyArray<ProviderDriverKind> {
  const metadata = thread.providerIdentity;
  if (
    controllerDriver === null ||
    metadata?.controllerInstanceId !== thread.modelSelection.instanceId ||
    metadata.controllerDriver !== controllerDriver
  ) {
    return [];
  }
  return [...new Set(metadata.delegatedDrivers)].filter((driver) => driver !== controllerDriver);
}

/**
 * Resolve truthful thread identity from configured provider state plus the
 * durable activity projection. Session provider is deliberately excluded:
 * it may be a delegate and must never replace the thread-owning controller.
 */
export function resolveThreadProviderIdentity(
  thread: Pick<OrchestrationThreadShell, "modelSelection" | "providerIdentity">,
  providers: ReadonlyArray<ServerProvider>,
): ThreadProviderIdentityPresentation {
  const controller = providers.find(
    (provider) => provider.instanceId === thread.modelSelection.instanceId,
  );
  if (!controller) {
    return {
      controller: { kind: "unknown", driverKind: null, displayName: "Unknown provider" },
      delegatedDrivers: [],
    };
  }

  const delegatedDrivers = resolveCurrentDelegatedProviderDrivers(thread, controller.driver);

  return {
    controller: {
      kind: "known",
      provider: controller,
      driverKind: controller.driver,
      displayName: resolveProviderInstanceDisplayName(controller),
    },
    delegatedDrivers,
  };
}
