import { useMemo } from "react";

import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  normalizeProviderAccentColor,
  resolveProviderInstanceDisplayName,
  shouldShowInstanceBadge,
} from "@t3tools/client-runtime/state/provider-instance-display";
import { resolveThreadProviderIdentity } from "@t3tools/client-runtime/state/provider-identity";
import type { EnvironmentId, ProviderDriverKind, ServerConfig } from "@t3tools/contracts";

/** What a thread row needs to draw the provider glyph and its account badge. */
export interface ThreadRowProviderInstance {
  readonly driverKind: ProviderDriverKind | null;
  readonly displayName: string;
  readonly accentColor?: string | undefined;
  readonly showBadge: boolean;
  readonly delegatedDrivers: ReadonlyArray<ProviderDriverKind>;
}

/**
 * Resolve the provider instance a thread runs on, scoped to the thread's own
 * environment: default instance ids are the driver slug, so the same id
 * names a different account on every server.
 */
export function resolveThreadProviderInstance(
  serverConfigs: ReadonlyMap<EnvironmentId, ServerConfig>,
  thread: EnvironmentThreadShell,
): ThreadRowProviderInstance | null {
  const providers = serverConfigs.get(thread.environmentId)?.providers ?? [];
  const identity = resolveThreadProviderIdentity(thread, providers);
  if (identity.controller.kind === "unknown") {
    return {
      driverKind: null,
      displayName: identity.controller.displayName,
      showBadge: false,
      delegatedDrivers: [],
    };
  }
  const snapshot = identity.controller.provider;
  const entry = {
    driverKind: snapshot.driver,
    displayName: resolveProviderInstanceDisplayName(snapshot),
    accentColor: normalizeProviderAccentColor(snapshot.accentColor),
  };
  return {
    ...entry,
    delegatedDrivers: identity.delegatedDrivers,
    showBadge: shouldShowInstanceBadge(
      entry,
      providers.map((provider) => ({ driverKind: provider.driver })),
    ),
  };
}

/**
 * Builds a resolver handing out reference-stable `ThreadRowProviderInstance`
 * objects. `resolveThreadProviderInstance` builds a fresh object per call,
 * which breaks the memoized row's props comparison on every parent render —
 * the result only depends on (environment, instance id), so one cache per
 * server-config generation keeps each row's `providerInstance` prop stable
 * until the instance behind the row actually changes.
 */
export function createThreadRowProviderInstanceResolver(
  serverConfigs: ReadonlyMap<EnvironmentId, ServerConfig>,
): (thread: EnvironmentThreadShell) => ThreadRowProviderInstance | null {
  const cache = new Map<string, ThreadRowProviderInstance | null>();
  return (thread) => {
    const instanceId = thread.modelSelection.instanceId;
    const identityKey = thread.providerIdentity
      ? `${thread.providerIdentity.controllerInstanceId}|${thread.providerIdentity.controllerDriver}|${thread.providerIdentity.delegatedDrivers.join(",")}`
      : "";
    const cacheKey = `${thread.environmentId}|${instanceId}|${identityKey}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
    const resolved = resolveThreadProviderInstance(serverConfigs, thread);
    cache.set(cacheKey, resolved);
    return resolved;
  };
}

/** List-scoped wrapper: one cache per server-config generation. */
export function useThreadRowProviderInstanceResolver(
  serverConfigs: ReadonlyMap<EnvironmentId, ServerConfig>,
): (thread: EnvironmentThreadShell) => ThreadRowProviderInstance | null {
  return useMemo(() => createThreadRowProviderInstanceResolver(serverConfigs), [serverConfigs]);
}
