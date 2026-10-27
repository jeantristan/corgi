export type Preset = "corgi" | "azerty" | "tmux" | "herdr" | "cmux";
export type Prefix = "ctrl_b" | "ctrl_a";
export const available_presets: Preset[] =
  process.platform === "darwin" ? ["corgi", "azerty", "tmux", "herdr", "cmux"] : ["corgi", "azerty", "tmux", "herdr"];
export function supportedPreset(preset: Preset): Preset {
  return preset === "cmux" && process.platform !== "darwin" ? "corgi" : preset;
}
export function prefixByte(prefix: Prefix): number {
  return prefix === "ctrl_a" ? 1 : 2;
}
export function prefixName(prefix: Prefix): string {
  return prefix === "ctrl_a" ? "Ctrl+A" : "Ctrl+B";
}
export function name(preset: Preset): string {
  return { corgi: "Corgi", azerty: "AZERTY", tmux: "tmux", herdr: "Herdr", cmux: "cmux" }[preset];
}
export function description(preset: Preset): string {
  return {
    corgi: "Made for Corgi",
    azerty: "Corgi + Ctrl+←/→ for tabs",
    tmux: "Prefix + classic splits",
    herdr: "Prefix + home row",
    cmux: "Command shortcuts",
  }[preset];
}
/** The description where a preset gets a narrow column. */
export function shortDescription(preset: Preset): string {
  return {
    corgi: "Made for Corgi",
    azerty: "Arrow tabs",
    tmux: "Classic splits",
    herdr: "Home row",
    cmux: "Command keys",
  }[preset];
}
