import { type CSSProperties, memo } from "react";
import { type ProviderDriverKind } from "@t3tools/contracts";
import { providerInstanceInitials } from "@t3tools/client-runtime/state/provider-instance-display";
import { delegatedProviderDisplayName } from "@t3tools/client-runtime/state/provider-identity";
import { CircleHelpIcon } from "lucide-react";

import { PROVIDER_ICON_BY_PROVIDER } from "./providerIconUtils";
import { cn } from "~/lib/utils";

export { providerInstanceInitials };

export const ProviderInstanceIcon = memo(function ProviderInstanceIcon(props: {
  driverKind: ProviderDriverKind | null;
  displayName: string;
  delegatedDrivers?: ReadonlyArray<ProviderDriverKind>;
  accentColor?: string | undefined;
  showBadge?: boolean;
  badgeContent?: "initials" | "none";
  className?: string;
  iconClassName?: string;
  badgeClassName?: string;
  statusDotClassName?: string;
  indicatorBackground?: string;
}) {
  const Icon = props.driverKind ? (PROVIDER_ICON_BY_PROVIDER[props.driverKind] ?? null) : null;
  const indicatorBackground = props.indicatorBackground ?? "var(--card)";
  const accentStyle = props.accentColor
    ? ({ "--provider-accent": props.accentColor } as CSSProperties)
    : undefined;
  const badgeContent = props.badgeContent ?? "initials";
  const delegatedDrivers = props.delegatedDrivers ?? [];
  const identityLabel = [
    `${props.displayName} controller`,
    ...delegatedDrivers.map((driver) => `${delegatedProviderDisplayName(driver)} delegated`),
  ].join(", ");

  return (
    <span
      className={cn(
        "isolate z-30 inline-flex shrink-0 items-center justify-center gap-0.5 overflow-visible",
        props.className,
      )}
      style={accentStyle}
      data-provider-accent-color={props.accentColor}
      data-provider-role="identity"
      role="img"
      aria-label={identityLabel}
    >
      <span className="relative inline-flex shrink-0 items-center justify-center overflow-visible">
        {Icon ? (
          <Icon className={cn("size-5 shrink-0", props.iconClassName)} aria-hidden />
        ) : (
          <CircleHelpIcon
            className={cn("size-5 shrink-0 text-muted-foreground", props.iconClassName)}
            aria-hidden
          />
        )}
        {props.statusDotClassName ? (
          <span
            className={cn(
              "pointer-events-none absolute -left-0.5 -top-0.5 z-10 size-2 rounded-full",
              props.statusDotClassName,
            )}
            style={{ boxShadow: `0 0 0 2px ${indicatorBackground}` }}
            aria-hidden
          />
        ) : null}
        {props.showBadge ? (
          <span
            className={cn(
              "pointer-events-none absolute right-0 bottom-0 z-10 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border px-0.5 text-[8px] font-semibold leading-none shadow-sm",
              props.accentColor
                ? "bg-[var(--provider-accent)] text-white"
                : "bg-card text-muted-foreground",
              props.badgeClassName,
            )}
            style={{ borderColor: indicatorBackground }}
            data-provider-role="account"
            aria-hidden
          >
            {badgeContent === "initials" ? providerInstanceInitials(props.displayName) : null}
          </span>
        ) : null}
      </span>
      {delegatedDrivers.length > 0 ? (
        <span
          className="inline-flex items-center gap-px"
          data-provider-role="delegates"
          aria-hidden
        >
          {delegatedDrivers.map((driver) => (
            <span
              key={driver}
              className="inline-flex h-3 min-w-3 items-center justify-center rounded-sm bg-muted px-0.5 text-[7px] font-bold leading-none text-muted-foreground ring-1 ring-border"
              data-delegated-provider={driver}
            >
              {providerInstanceInitials(delegatedProviderDisplayName(driver)).slice(0, 1)}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
});
