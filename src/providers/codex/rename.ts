//! Renames a Codex thread through its app server's control socket, or, when
//! no app server serves it, by typing `/rename` into its composer.
import { visibleWidth } from "@earendil-works/pi-tui";
import * as socket from "./socket";
import * as errors from "../../errors";
import type { Terminal } from "../../pane/terminal";
export async function rename(path: string, id: string, name: string) {
  const client = await socket.Client.open(path);
  try {
    await client.call("thread/name/set", { threadId: id, name });
  } catch (error) {
    if (errors.is(error, "RpcError")) throw Error("RenameUnavailable");
    throw error;
  } finally {
    client.close();
  }
}
export function command(name: string) {
  return "/rename " + name;
}
/** The composer row the cursor sits on, unless a prompt covers it. */
function input(t: Terminal) {
  if (t.title.includes("[ ! ] Action Required")) return null;
  const surface = t.surface(0).surface,
    cursor = surface.cursor;
  if (!cursor) return null;
  const raw = surface.lines[cursor.y] ?? "";
  const characters: {
    text: string;
    bold: boolean;
    faint: boolean;
    inverse: boolean;
  }[] = [];
  let bold = false,
    faint = false,
    inverse = false;
  for (const match of raw.matchAll(/\x1b\[([0-9;]*)m|([^\x1b]+)/gu)) {
    if (match[1] !== undefined) {
      const codes = match[1].split(";").map(Number);
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        if (code === 0) {
          bold = false;
          faint = false;
          inverse = false;
        } else if (code === 1) bold = true;
        else if (code === 2) faint = true;
        else if (code === 7) inverse = true;
        else if (code === 22) {
          bold = false;
          faint = false;
        } else if (code === 27) inverse = false;
        else if (code === 38 || code === 48 || code === 58) i += codes[i + 1] === 2 ? 4 : 2;
      }
    } else for (const text of match[2]) characters.push({ text, bold, faint, inverse });
  }
  const marker = characters[0];
  if (marker?.text !== "›" || characters[1]?.text !== " " || !marker.bold || marker.faint || marker.inverse)
    return null;
  const text = characters
    .slice(2)
    .map(c => c.text)
    .join("")
    .trimEnd();
  const visible = characters.slice(2).filter(c => c.text.trim().length > 0);
  return {
    text,
    placeholder: visible.length > 0 && visible.every(c => c.faint),
    text_end: 2 + visibleWidth(text),
    cursor: cursor.x,
    below: surface.lines
      .slice(cursor.y + 1, cursor.y + 4)
      .join("\n")
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""),
  };
}
export function empty(t: Terminal) {
  const row = input(t);
  return !!row && row.cursor === 2 && row.placeholder && row.below.includes("? for shortcuts");
}
export function holds(t: Terminal, text: string) {
  const row = input(t);
  return !!row && !row.placeholder && row.text === text && row.cursor === row.text_end;
}
