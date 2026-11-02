// Update flashing (agent/overlay.ts capRects): a 1000-node update draws at most MAX_FLASH boxes, the rest merged.
import { test } from "vitest";
import assert from "node:assert/strict";
import { MAX_FLASH, capRects } from "../agent/overlay.ts";

test("capRects: small updates unchanged; a 1000-row update is capped with one bounding box for the rest", () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ left: 10, top: i * 20, width: 300, height: 20 }));
  assert.equal(capRects(rows.slice(0, 50)).length, 50);
  const capped = capRects(rows);
  assert.equal(capped.length, MAX_FLASH);
  assert.deepEqual(capped.at(-1), { left: 10, top: (MAX_FLASH - 1) * 20, width: 300, height: (1000 - MAX_FLASH + 1) * 20 });
});
