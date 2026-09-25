import { resolveCurrentDelegatedProviderDrivers } from "@t3tools/client-runtime/state/provider-identity";
import { shouldShowInstanceBadge } from "@t3tools/client-runtime/state/provider-instance-display";
import type { OrchestrationThread, OrchestrationThreadShell } from "@t3tools/contracts";

import type { ProviderInstanceEntry } from "../providerInstances";

export function resolveWebThreadProviderIdentity(
  thread: Pick<
    OrchestrationThread | OrchestrationThreadShell,
    "modelSelection" | "providerIdentity"
  >,
  entries: Iterable<ProviderInstanceEntry>,
) {
  const allEntries = [...entries];
  const controller = allEntries.find(
    (entry) => entry.instanceId === thread.modelSelection.instanceId,
  );
  const driverKind = controller?.driverKind ?? null;
  return {
    controller,
    driverKind,
    displayName: controller?.displayName ?? "Unknown provider",
    showBadge: controller !== undefined && shouldShowInstanceBadge(controller, allEntries),
    delegatedDrivers: resolveCurrentDelegatedProviderDrivers(thread, driverKind),
  };
}
