import {
  DevinSettings,
  ProviderDriverKind,
  type ServerProviderSlashCommand,
  type ThreadId,
} from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import { HttpClient } from "effect/unstable/http";
import { ChildProcessSpawner } from "effect/unstable/process";

import * as BackgroundPolicy from "../../background/BackgroundPolicy.ts";
import { ServerConfig } from "../../config.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import { makeDevinTextGeneration } from "../../textGeneration/DevinTextGeneration.ts";
import { ProviderDriverError } from "../Errors.ts";
import { makeDevinAdapter } from "../Layers/DevinAdapter.ts";
import { resolveEffectiveDevinBinary } from "./DevinBinary.ts";
import { makeDevinContinuationGroupKey, makeDevinEnvironment } from "./DevinHome.ts";
import {
  buildInitialDevinProviderSnapshot,
  checkDevinProviderStatus,
  enrichDevinSnapshot,
  mergeDevinSlashCommands,
} from "../Layers/DevinProvider.ts";
import { ProviderEventLoggers } from "../Layers/ProviderEventLoggers.ts";
import { makeManagedServerProvider } from "../makeManagedServerProvider.ts";
import { type ProviderDriver, type ProviderInstance } from "../ProviderDriver.ts";
import { mergeProviderInstanceEnvironment } from "../ProviderInstanceEnvironment.ts";
import { withInstanceIdentity } from "./instanceIdentity.ts";
import {
  makeCachedProviderMaintenanceResolution,
  makeManualOnlyProviderMaintenanceCapabilities,
  makeProviderMaintenanceCapabilities,
  type ProviderMaintenanceCapabilitiesResolver,
  resolveProviderMaintenanceCapabilitiesEffect,
} from "../providerMaintenance.ts";
import {
  haveProviderSnapshotSettingsChanged,
  makeProviderSnapshotSettingsSource,
  type ProviderSnapshotSettings,
} from "../providerUpdateSettings.ts";

const decodeDevinSettings = Schema.decodeSync(DevinSettings);

const DRIVER_KIND = ProviderDriverKind.make("devin");
const UPDATE: ProviderMaintenanceCapabilitiesResolver = {
  resolve: (context) =>
    Effect.succeed(
      context
        ? makeProviderMaintenanceCapabilities({
            provider: DRIVER_KIND,
            packageName: null,
            updateExecutable: context.resolvedCommandPath,
            updateArgs: ["update"],
            updateLockKey: "devin-native",
            platform: context.platform,
            env: context.env,
          })
        : makeManualOnlyProviderMaintenanceCapabilities({
            provider: DRIVER_KIND,
            packageName: null,
          }),
    ),
};

export type DevinDriverEnv =
  | BackgroundPolicy.BackgroundPolicy
  | ChildProcessSpawner.ChildProcessSpawner
  | Crypto.Crypto
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | Path.Path
  | ProviderEventLoggers
  | ServerConfig
  | ServerSettingsService;

export const DevinDriver: ProviderDriver<DevinSettings, DevinDriverEnv> = {
  driverKind: DRIVER_KIND,
  metadata: {
    displayName: "Devin",
    supportsMultipleInstances: true,
  },
  configSchema: DevinSettings,
  defaultConfig: (): DevinSettings => decodeDevinSettings({}),
  create: ({ instanceId, displayName, accentColor, environment, enabled, config }) =>
    Effect.gen(function* () {
      const crypto = yield* Crypto.Crypto;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const httpClient = yield* HttpClient.HttpClient;
      const serverSettings = yield* ServerSettingsService;
      const eventLoggers = yield* ProviderEventLoggers;
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const processEnv = mergeProviderInstanceEnvironment(environment);
      const continuationGroupKey = yield* makeDevinContinuationGroupKey(config);
      const continuationIdentity = {
        driverKind: DRIVER_KIND,
        continuationKey: continuationGroupKey,
      };
      const stampIdentity = withInstanceIdentity({
        instanceId,
        driverKind: DRIVER_KIND,
        displayName,
        accentColor,
        continuationGroupKey: continuationIdentity.continuationKey,
      });

      const resolvedBinary = yield* resolveEffectiveDevinBinary(config.binaryPath, processEnv);
      const devinEnv = yield* makeDevinEnvironment(config, processEnv);

      const effectiveConfig = {
        ...config,
        enabled,
        binaryPath: resolvedBinary,
      } satisfies DevinSettings;
      const sessionCommandsRef = yield* Ref.make(
        new Map<ThreadId, ReadonlyArray<ServerProviderSlashCommand>>(),
      );
      const refreshCommandsSnapshotRef = yield* Ref.make<Effect.Effect<void, never>>(Effect.void);
      const updateSessionCommands = (input: {
        readonly threadId: ThreadId;
        readonly commands: ReadonlyArray<ServerProviderSlashCommand>;
      }) =>
        Effect.gen(function* () {
          const changed = yield* Ref.modify(sessionCommandsRef, (current) => {
            const previousCommands = current.get(input.threadId) ?? [];
            if (JSON.stringify(previousCommands) === JSON.stringify(input.commands)) {
              return [false, current] as const;
            }
            const next = new Map(current);
            if (input.commands.length === 0) {
              next.delete(input.threadId);
            } else {
              next.set(input.threadId, input.commands);
            }
            return [true, next] as const;
          });
          if (changed) {
            yield* Ref.get(refreshCommandsSnapshotRef).pipe(Effect.flatten);
          }
        });
      const resolveMaintenance = yield* makeCachedProviderMaintenanceResolution(
        resolveProviderMaintenanceCapabilitiesEffect(UPDATE, {
          binaryPath: effectiveConfig.binaryPath,
          env: processEnv,
        }).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
          Effect.provideService(FileSystem.FileSystem, fileSystem),
          Effect.provideService(Path.Path, path),
        ),
      );

      const adapter = yield* makeDevinAdapter(effectiveConfig, {
        environment: devinEnv,
        ...(eventLoggers.native ? { nativeEventLogger: eventLoggers.native } : {}),
        instanceId,
        onAvailableCommandsChanged: updateSessionCommands,
      });
      const textGeneration = yield* makeDevinTextGeneration(effectiveConfig, devinEnv);

      const checkProvider = checkDevinProviderStatus(effectiveConfig, devinEnv).pipe(
        Effect.flatMap((provider) =>
          Ref.get(sessionCommandsRef).pipe(
            Effect.map((sessionCommands) => ({
              ...provider,
              slashCommands: mergeDevinSlashCommands(
                provider.slashCommands,
                ...sessionCommands.values(),
              ),
            })),
          ),
        ),
        Effect.map(stampIdentity),
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provideService(Path.Path, path),
      );

      const snapshotSettings = makeProviderSnapshotSettingsSource(effectiveConfig, serverSettings);
      const snapshot = yield* makeManagedServerProvider<ProviderSnapshotSettings<DevinSettings>>({
        resolveMaintenance,
        getSettings: snapshotSettings.getSettings,
        streamSettings: snapshotSettings.streamSettings,
        haveSettingsChanged: haveProviderSnapshotSettingsChanged,
        initialSnapshot: (settings) =>
          buildInitialDevinProviderSnapshot(settings.provider).pipe(Effect.map(stampIdentity)),
        checkProvider,
        enrichSnapshot: ({ settings, snapshot: currentSnapshot, publishSnapshot }) =>
          resolveMaintenance().pipe(
            Effect.flatMap((maintenanceCapabilities) =>
              enrichDevinSnapshot({
                snapshot: currentSnapshot,
                maintenanceCapabilities,
                enableProviderUpdateChecks: settings.enableProviderUpdateChecks,
                publishSnapshot,
                httpClient,
              }),
            ),
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
          ),
      }).pipe(
        Effect.mapError(
          (cause) =>
            new ProviderDriverError({
              driver: DRIVER_KIND,
              instanceId,
              detail: "Failed to build the Devin provider snapshot.",
              cause,
            }),
        ),
      );

      yield* Ref.set(refreshCommandsSnapshotRef, snapshot.refresh.pipe(Effect.asVoid));

      return {
        instanceId,
        driverKind: DRIVER_KIND,
        continuationIdentity,
        displayName,
        accentColor,
        enabled,
        snapshot,
        adapter,
        textGeneration,
      } satisfies ProviderInstance;
    }),
};
