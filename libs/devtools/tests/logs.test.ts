// The HMR / error panes' lists (ui/store.ts appendHmr / upsertError): bounded at LOG_CAP like the agent's own logs,
// updates replace in place, no filter + sort of the whole list per event.
import { beforeAll, test, vi } from "vitest";
import assert from "node:assert/strict";
import type { ErrorEntry, HmrEntry } from "../protocol.ts";

let store: typeof import("../ui/store.ts");
beforeAll(async () => {
  vi.stubGlobal("location", { hash: "" });
  vi.stubGlobal("addEventListener", () => {});
  store = await import("../ui/store.ts");
});

const error = (id: number, message = "e" + id): ErrorEntry => ({ id, kind: "runtime", message, ts: id, frames: [] });
const hmr = (ts: number, state?: HmrEntry["state"]): HmrEntry => ({ kind: "update", ts, ...(state ? { state } : {}) });

test("upsertError: located re-sends replace in place, new ids append, out-of-order ids insert sorted, capped", () => {
  let list: ErrorEntry[] = [];
  for (const id of [1, 2, 3]) list = store.upsertError(list, error(id));
  list = store.upsertError(list, error(2, "located"));
  assert.deepEqual(
    list.map((e) => [e.id, e.message]),
    [
      [1, "e1"],
      [2, "located"],
      [3, "e3"],
    ],
  );
  list = store.upsertError(list, error(5));
  list = store.upsertError(list, error(4));
  assert.deepEqual(
    list.map((e) => e.id),
    [1, 2, 3, 4, 5],
  );
  for (let id = 6; id <= store.LOG_CAP + 50; id++) list = store.upsertError(list, error(id));
  assert.equal(list.length, store.LOG_CAP);
  assert.equal(list[0]!.id, 51);
  assert.equal(list.at(-1)!.id, store.LOG_CAP + 50);
});

test("appendHmr: an update of the latest entry replaces it; the log stays at LOG_CAP", () => {
  let list: HmrEntry[] = [];
  list = store.appendHmr(list, hmr(1));
  list = store.appendHmr(list, hmr(1, "kept"));
  assert.deepEqual(list, [hmr(1, "kept")]);
  for (let ts = 2; ts <= store.LOG_CAP + 10; ts++) list = store.appendHmr(list, hmr(ts));
  assert.equal(list.length, store.LOG_CAP);
  assert.equal(list[0]!.ts, 11);
  list = store.appendHmr(list, hmr(store.LOG_CAP + 10, "shape"));
  assert.equal(list.length, store.LOG_CAP);
  assert.deepEqual(list.at(-1), hmr(store.LOG_CAP + 10, "shape"));
});
