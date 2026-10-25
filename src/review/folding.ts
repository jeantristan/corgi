//! Which test diffs start folded in a mixed review.
import type { Change } from "./git";

/** Test directories and common test/spec filename conventions. */
export function isTest(path: string): boolean {
  return (
    /(^|\/)(__tests__|__snapshots__|tests?|specs?)\//.test(path) ||
    /(^|\/)(test|spec)_[^/]+$/.test(path) ||
    /[._](test|spec)\.[^/]+$/.test(path) ||
    /(Test|Tests|Spec)\.[^/]+$/.test(path)
  );
}

/** Fold tests when non-test edits total at least a quarter of test edits.
 * Generated and binary files don't contribute to either side. */
export function tests(changes: readonly Change[]): Set<string> {
  const paths = new Set<string>();
  let tests = 0,
    other = 0;
  for (const change of changes) {
    if (change.generated || change.binary) continue;
    const lines = (change.adds ?? 0) + (change.dels ?? 0);
    if (isTest(change.path)) {
      paths.add(change.path);
      tests += lines;
    } else other += lines;
  }
  return tests > 0 && other * 4 >= tests ? paths : new Set();
}
