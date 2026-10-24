//! The host terminal's background, moved to the one Corgi paints. The
//! terminal fills the margin around its cell grid with its own background,
//! so this takes a painted theme to the window's edges.
import type { Rgb } from "./palette";

let set: string | null = null;
/** What moves the host's background to `rgb`, or gives it back its own for
 * null; empty when it is there already. */
export function follow(rgb: Rgb | null): string {
  const hex = rgb && rgb.map(v => v.toString(16).padStart(2, "0")).join("");
  if (hex === set) return "";
  set = hex;
  return hex ? `\x1b]11;#${hex}\x1b\\` : "\x1b]111\x1b\\";
}
/** Gives the host its own background back, before leaving or before asking
 * for its colors. */
export function release(): string {
  return follow(null);
}
