import { test, expect } from "bun:test";
import * as hostBackground from "./host_background";

test("the host's background follows the painted one and comes back once", () => {
  // Never moved, there is nothing to give back.
  expect(hostBackground.release()).toBe("");
  expect(hostBackground.follow([24, 27, 32])).toBe("\x1b]11;#181b20\x1b\\");
  expect(hostBackground.follow([24, 27, 32])).toBe("");
  expect(hostBackground.follow([35, 40, 47])).toBe("\x1b]11;#23282f\x1b\\");
  expect(hostBackground.follow(null)).toBe("\x1b]111\x1b\\");
  expect(hostBackground.release()).toBe("");
});
