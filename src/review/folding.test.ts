import { expect, test } from "bun:test";
import * as folding from "./folding";
import type { Change } from "./git";

const change = (path: string, adds: number | null, dels = 0, extra: Partial<Change> = {}): Change => ({
  path,
  from: null,
  kind: "modified",
  adds,
  dels,
  binary: false,
  generated: false,
  funcname: false,
  ...extra,
});

test("recognizes test directories and filenames without matching ordinary names", () => {
  for (const path of [
    "tests/helpers.ts",
    "src/test/java/App.java",
    "spec/app.rb",
    "specs/app.ts",
    "src/__tests__/app.ts",
    "src/__snapshots__/app.snap",
    "src/app.test.ts",
    "src/app.spec.tsx",
    "src/app_test.go",
    "src/app_spec.rb",
    "test_app.py",
    "src/test_app.py",
    "src/spec_app.rb",
    "src/AppTest.java",
    "src/AppTests.cs",
    "src/AppSpec.scala",
  ])
    expect(folding.isTest(path)).toBe(true);
  for (const path of ["src/app.ts", "src/contest.ts", "src/testing.ts", "src/test_utils/app.ts", "spec.md"])
    expect(folding.isTest(path)).toBe(false);
});

test("folds tests at a 1:4 non-test to test ratio, counting additions and deletions across files", () => {
  const tests = [change("app.test.ts", 60, 20), change("tests/other.ts", 10, 10)];
  expect(folding.tests([...tests, change("app.ts", 14, 10)])).toEqual(new Set());
  expect(folding.tests([...tests, change("app.ts", 14, 10), change("other.ts", 0, 1)])).toEqual(
    new Set(["app.test.ts", "tests/other.ts"]),
  );
  expect(folding.tests([...tests, change("app.ts", 100)])).toEqual(new Set(["app.test.ts", "tests/other.ts"]));
});

test("test-only changes and changes without counted test lines stay open", () => {
  expect(folding.tests([change("app.test.ts", 10)])).toEqual(new Set());
  expect(folding.tests([change("app.test.ts", 10), change("app.ts", 0)])).toEqual(new Set());
  expect(folding.tests([change("app.test.ts", null), change("app.ts", 10)])).toEqual(new Set());
  expect(folding.tests([])).toEqual(new Set());
});

test("generated and binary files cannot tip the ratio in either direction", () => {
  const tests = change("app.test.ts", 100),
    ignored = [
      change("bun.lock", 1000, 0, { generated: true }),
      change("image.png", null, 0, { binary: true }),
      change("tests/generated.ts", 1000, 0, { generated: true }),
      change("tests/image.png", null, 0, { binary: true }),
    ];
  expect(folding.tests([tests, change("app.ts", 24), ...ignored])).toEqual(new Set());
  expect(folding.tests([tests, change("app.ts", 25), ...ignored])).toEqual(new Set(["app.test.ts"]));
});
