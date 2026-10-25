import { test, expect } from "bun:test";
import { State, reply_prefix, hide, hit, place, needsExplicitSize } from "./corgi_badge";
import { Terminal } from "./pane/terminal";
const reply = (body: string) => reply_prefix + body + "\x1b\\";
test("badge uploads only on support or lost-image recovery", () => {
  const s = new State();
  expect(s.upload(0)).toBe("");
  expect(s.accept(reply("i=730031;OK"))).toBe(true);
  const out = s.upload(0);
  expect(out.includes("m=1;")).toBe(true);
  expect(out.includes("m=0;")).toBe(true);
  s.accept(reply("i=730031;OK"));
  expect(s.upload(2000)).toBe("");
  expect(place().length).toBeLessThan(100);
  s.accept(reply("i=730031,p=1;ENOENT:missing"));
  expect(s.upload(4000).length).toBeGreaterThan(100);
  expect(s.accept(reply("i=7300319;OK"))).toBe(false);
});
test("unanswered probe falls back to the emoji and upgrades on a late reply", () => {
  const s = new State();
  s.upload(1000);
  expect(s.mode()).toBe("none");
  expect(s.upload(2500)).toBe("");
  expect(s.mode()).toBe("emoji");
  s.accept(reply("i=730031;OK"));
  expect(s.upload(3000).length).toBeGreaterThan(100);
  s.accept(reply("i=730031;OK"));
  expect(s.mode()).toBe("image");
});
test("emoji hit area covers only its two cells", () => {
  expect(hit("emoji", 30, 1, 0)).toBe(false);
  expect(hit("emoji", 30, 2, 0)).toBe(true);
  expect(hit("emoji", 30, 3, 0)).toBe(true);
  expect(hit("emoji", 30, 4, 0)).toBe(false);
  expect(hit("emoji", 30, 2, 1)).toBe(false);
  expect(hit("image", 30, 4, 1)).toBe(true);
  expect(hit("none", 30, 2, 0)).toBe(false);
  expect(hit("emoji", 0, 2, 0)).toBe(false);
});
test("chunked upload with a wrong acknowledgement ID is confirmed by placement", () => {
  const s = new State();
  s.accept(reply("i=730031;OK"));
  s.upload(0);
  expect(s.accept(reply("i=0;OK"))).toBe(false);
  expect(s.status).toBe("uploading");
  const out = s.upload(3000, { width: 9, height: 18 }, true);
  expect(s.status).toBe("confirming");
  expect(out.includes("a=p,i=730031,p=1,c=3,r=2,X=0,Y=9,z=1,C=1,q=0")).toBe(true);
  expect(out.endsWith(hide)).toBe(true);
  s.accept(reply("p=1,i=730031;OK"));
  expect(s.mode()).toBe("image");
  expect(s.upload(10000)).toBe("");
  s.accept(reply("p=1,i=730031;ENOENT:missing"));
  expect(s.upload(10000).length).toBeGreaterThan(100);
});
test("badge replies require exact image and placement IDs in any field order", () => {
  const s = new State();
  for (const body of [
    "i=0;OK",
    "i=7300319;OK",
    "p=1;OK",
    "i=730031,p=2;OK",
    "i=730031,i=0;OK",
    "i=0,i=730031;OK",
    "i=730031,p=1,p=2;OK",
  ])
    expect(s.accept(reply(body))).toBe(false);
  expect(s.supports_kitty_graphics).toBe(false);
  expect(s.accept(reply("p=1,i=730031;OK"))).toBe(true);
});
test("missing upload and placement acknowledgements fall back without losing capability", () => {
  const s = new State();
  s.accept(reply("i=730031;OK"));
  for (let i = 0; i < 3; i++) {
    expect(s.upload(i * 4500).length).toBeGreaterThan(100);
    expect(s.upload(i * 4500 + 3000).length).toBeLessThan(200);
    expect(s.status).toBe("confirming");
  }
  expect(s.upload(13500)).toBe("");
  expect(s.mode()).toBe("emoji");
  expect(s.supports_kitty_graphics).toBe(true);
});
test("placement missing-image replies retry only a bounded number of uploads", () => {
  const s = new State();
  s.accept(reply("i=730031;OK"));
  for (let i = 0; i < 3; i++) {
    expect(s.upload(i * 3000).length).toBeGreaterThan(100);
    s.upload(i * 3000 + 3000);
    s.accept(reply("p=1,i=730031;ENOENT:missing"));
  }
  expect(s.upload(9000)).toBe("");
  expect(s.mode()).toBe("emoji");
  expect(s.supports_kitty_graphics).toBe(true);
});
test("successful uploads do not reset failed placement retries", () => {
  const s = new State();
  s.accept(reply("i=730031;OK"));
  for (let i = 0; i < 3; i++) {
    expect(s.upload(i * 100).length).toBeGreaterThan(100);
    expect(s.mode()).toBe("emoji");
    s.accept(reply("i=730031;OK"));
    expect(s.mode()).toBe("image");
    s.accept(reply("p=1,i=730031;ENOENT:missing"));
    expect(s.mode()).toBe("emoji");
  }
  expect(s.upload(1000)).toBe("");
  expect(s.status).toBe("unavailable");
  expect(s.supports_kitty_graphics).toBe(true);
});
test("a hidden confirmation probe does not reset failed visible placements", () => {
  const s = new State();
  s.accept(reply("i=730031;OK"));
  for (let i = 0; i < 3; i++) {
    expect(s.upload(i * 3000).length).toBeGreaterThan(100);
    expect(s.upload(i * 3000 + 3000)).toContain(hide);
    s.accept(reply("p=1,i=730031;OK"));
    s.accept(reply("p=1,i=730031;ENOENT:missing"));
  }
  expect(s.upload(10000)).toBe("");
  expect(s.mode()).toBe("emoji");
});
test("successful visible placements restore the retry budget after image loss", () => {
  const s = new State();
  s.accept(reply("i=730031;OK"));
  for (let i = 0; i < 8; i++) {
    expect(s.upload(i * 100).length).toBeGreaterThan(100);
    s.accept(reply("i=730031;OK"));
    expect(place()).toContain("q=0");
    s.accept(reply("p=1,i=730031;OK"));
    expect(s.mode()).toBe("image");
    s.accept(reply("p=1,i=730031;ENOENT:missing"));
  }
  expect(s.status).toBe("supported");
});

test("badge stays square within its cells as the terminal font changes", () => {
  const terminal = Terminal.create(20, 5);
  try {
    const state = new State();
    state.accept(reply("i=730031;OK"));
    terminal.feed(state.upload(0));
    for (const cell of [
      { width: 9, height: 18 },
      { width: 8, height: 19 },
      { width: 7, height: 24 },
      { width: 18, height: 36 },
      { width: 16, height: 16 },
      { width: 20, height: 8 },
    ]) {
      terminal.native({ op: "pixels", start_x: cell.width, start_y: cell.height });
      for (const explicit of [false, true]) {
        terminal.feed(place(cell, explicit));
        const images = terminal.surface(1).surface.images!;
        expect(images).toHaveLength(1);
        const image = images[0],
          side = Math.min(3 * cell.width, 2 * cell.height);
        expect(image.width * cell.width).toBeCloseTo(side);
        expect(image.height * cell.height).toBeCloseTo(side);
        expect(image.x).toBeGreaterThanOrEqual(2);
        expect(image.x + image.width).toBeLessThanOrEqual(5);
        expect(image.y).toBeGreaterThanOrEqual(0);
        expect(image.y + image.height).toBeLessThanOrEqual(2);
      }
    }
  } finally {
    terminal.destroy();
  }
});

test("without pixel measurements the terminal determines the badge's height", () => {
  expect(place()).toContain("p=1,c=3,z=1");
});

test("Ghostty preserves badge proportions with only one dimension specified", () => {
  for (const name of ["ghostty 1.2.3", "xterm-ghostty", "iTerm2 3.5", ""]) {
    const explicit = needsExplicitSize(name);
    expect(explicit).toBe(false);
    expect(place({ width: 9, height: 18 }, explicit)).toContain("p=1,c=3,z=1");
    expect(place({ width: 16, height: 16 }, explicit)).toContain("p=1,r=2,z=1");
  }
  for (const name of ["kitty(0.26.5)", "kitty 0.26.5", "xterm-kitty"]) expect(needsExplicitSize(name)).toBe(true);
});
