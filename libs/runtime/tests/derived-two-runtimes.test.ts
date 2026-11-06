// COFLAT (2026-11-06): a build with the list-free runtime copy (`derived-features.ts` `TWO`, manifest `flat`) may evaluate
// both copies on one page (a co-load group put an app module into the full runtime's chunk). A copy evaluated after another
// one started (`_adoption.same` set) leaves the component ABI to the started one; `start` installs its own again.
import { test, vi } from "vitest";
import assert from "node:assert/strict";

const installed = vi.hoisted((): unknown[] => []);
// The ABI module as dom-derived uses it: `_abi` records each install.
vi.mock("../dom-derived-abi.ts", () => ({
  _abi: (impl: unknown) => void installed.push(impl),
  _guard: <T>(s: T) => s,
  _b: () => {},
  _sig: () => {},
  _sigStore: () => {},
  _dsignal: () => {},
}));

test("a runtime copy evaluated after another started does not take the ABI over; start re-installs", async () => {
  const { _adoption } = await import("../dom-v2.ts");
  const was = _adoption.same;
  try {
    _adoption.same = null;
    // Before any start: evaluation installs (as without a second copy).
    // @ts-expect-error a second module instance by query (vite): no declarations for the query id
    const first = (await import("../dom-derived.ts?first")) as unknown as { default: { start: (...args: unknown[]) => void } };
    assert.equal(installed.length, 1);
    // A runtime started (it set `_adoption.same`): the next copy's evaluation installs nothing.
    _adoption.same = Object.is;
    // @ts-expect-error as above
    await import("../dom-derived.ts?second");
    assert.equal(installed.length, 1, "a late copy leaves the started runtime's ABI");
    // Starting a copy installs its own implementations again.
    // (No document here: `start` installs first, then fails on the stub; only the install is under test.)
    try {
      first.default.start({ b: [] }, {}, { q: [], f: () => {} });
    } catch {
      // the stub document
    }
    assert.equal(installed.length, 2);
    assert.equal((installed[1] as { b: unknown }).b, (installed[0] as { b: unknown }).b, "the started copy's own implementations");
  } finally {
    _adoption.same = was;
  }
});
