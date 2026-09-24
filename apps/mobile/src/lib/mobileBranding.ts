export type MobileStageLabel = "Alpha" | "Dev" | "Devin" | "OpenCode";

export function resolveMobileStageLabel(appVariant: unknown): MobileStageLabel {
  if (appVariant === "development") return "Dev";
  if (appVariant === "opencode") return "OpenCode";
  if (appVariant === "preview") return "Devin";
  return "Alpha";
}
