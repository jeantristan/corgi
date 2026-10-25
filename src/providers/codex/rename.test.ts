import { test, expect } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as rename from "./rename";
import { Terminal } from "../../pane/terminal";

test.each(["success", "rejected", "disconnected"] as const)("Codex rename over WebSocket: %s", async outcome => {
  const dir = fs.mkdtempSync(os.tmpdir() + "/corgi-rename-"),
    socket = dir + "/control.sock",
    id = "01901234-1234-1234-1234-123456789abc",
    name = 'corgi "rename" ⑂',
    paths: string[] = [],
    messages: { method: string; params: unknown }[] = [],
    closed = Promise.withResolvers<void>();
  const server = Bun.serve({
    unix: socket,
    fetch(req, server) {
      paths.push(new URL(req.url).pathname);
      return server.upgrade(req) ? undefined : new Response("bad", { status: 400 });
    },
    websocket: {
      message(ws, message) {
        const value = JSON.parse(String(message));
        messages.push({ method: value.method, params: value.params });
        switch (value.method) {
          case "initialize":
            ws.send(JSON.stringify({ id: value.id, result: {} }));
            break;
          case "initialized":
            break;
          case "thread/name/set":
            switch (outcome) {
              case "success":
                ws.send(JSON.stringify({ id: value.id, result: {} }));
                break;
              case "rejected":
                ws.send(JSON.stringify({ id: value.id, error: { code: -32603, message: "rename failed" } }));
                break;
              case "disconnected":
                ws.close();
                break;
            }
            break;
          default:
            ws.close();
        }
      },
      close() {
        closed.resolve();
      },
    },
  });
  try {
    const result = rename.rename(socket, id, name);
    if (outcome === "success") await result;
    else await expect(result).rejects.toThrow(outcome === "rejected" ? "RenameUnavailable" : "Disconnected");
    expect(paths).toEqual(["/rpc"]);
    expect(messages.map(message => message.method)).toEqual(["initialize", "initialized", "thread/name/set"]);
    expect(messages[2].params).toEqual({ threadId: id, name });
    await closed.promise;
  } finally {
    server.stop(true);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function screen(t: Terminal, input: string, footer: string) {
  t.feed("\x1b[2J\x1b[H\x1b[1;2m› \x1b[0mearlier prompt\r\n\r\n");
  t.feed(input);
  t.feed("\r\n  gpt · /tmp\r\n  ");
  t.feed(footer);
  t.feed("\x1b[3;3H");
}
test("only Codex's empty input box reads as empty", () => {
  const t = Terminal.create(60, 8);
  try {
    screen(t, "\x1b[1m›\x1b[0m \x1b[2mAsk Codex to do anything\x1b[0m", "\x1b[1m?\x1b[0m for shortcuts");
    expect(rename.empty(t)).toBe(true);
    expect(rename.holds(t, "Ask Codex to do anything")).toBe(false);
    for (const [input, footer] of [
      ["\x1b[1m›\x1b[0m Ask Codex to do anything", ""],
      ["\x1b[1m›\x1b[0m \x1b[2mAsk Codex to do anything\x1b[0m", "\x1b[1m?\x1b[0m / \x1b[1mesc\x1b[0m close"],
      ["\x1b[1;7m› 1. Yes, proceed (y)\x1b[0m", "\x1b[1m?\x1b[0m for shortcuts"],
      ["\x1b[1;2m› \x1b[0m\x1b[2mAsk Codex to do anything\x1b[0m", "\x1b[1m?\x1b[0m for shortcuts"],
    ]) {
      screen(t, input, footer);
      expect(rename.empty(t)).toBe(false);
    }
    screen(t, "\x1b[1m›\x1b[0m \x1b[2mAsk Codex to do anything\x1b[0m", "\x1b[2mreverse-i-search: \x1b[0m");
    t.feed("\x1b[5;21H");
    expect(rename.empty(t)).toBe(false);
    screen(t, "\x1b[1m›\x1b[0m \x1b[2mAsk Codex to do anything\x1b[0m", "\x1b[1m?\x1b[0m for shortcuts");
    t.feed("\x1b]0;[ ! ] Action Required | codex\x07");
    expect(rename.empty(t)).toBe(false);
  } finally {
    t.destroy();
  }
});
test("Codex's input row holds the typed command, cursor after it", () => {
  const t = Terminal.create(60, 8),
    typed = rename.command("corgi ⑂");
  try {
    screen(t, "\x1b[1m›\x1b[0m \x1b[36m/rename\x1b[0m corgi ⑂", "");
    t.feed("\x1b[3;18H");
    expect(rename.holds(t, typed)).toBe(true);
    expect(rename.holds(t, "/rename corgi")).toBe(false);
    t.feed("\x1b[3;5H");
    expect(rename.holds(t, typed)).toBe(false);
  } finally {
    t.destroy();
  }
});
