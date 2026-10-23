import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("scheduler: independent package export and root barrel", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.exports["./scheduler"]?.default, "./src/components/scheduler/index.ts");
  assert.match(readFileSync(new URL("../index.ts", import.meta.url), "utf8"), /export \* from "\.\/src\/components\/scheduler\/index\.ts"/);
});

test("scheduler: every specified tv slot composes caller overrides", async () => {
  const { schedulerVariants } = await import("../styles/src/components/scheduler/index.ts");
  const slots = schedulerVariants();
  for (const slot of [
    "base",
    "toolbar",
    "title",
    "grid",
    "header",
    "cell",
    "slot",
    "allDay",
    "event",
    "eventTitle",
    "eventTime",
    "more",
    "morePanel",
    "nowLine",
    "handle",
    "menu",
  ] as const) {
    assert.match(slots[slot]({ class: "caller" }), /\bcaller\b/, slot);
  }
  assert.match(schedulerVariants({ density: "compact", variant: "secondary" }).base(), /scheduler--compact/);
  assert.match(schedulerVariants({ variant: "secondary" }).base(), /scheduler--secondary/);
  assert.match(schedulerVariants({ density: "compact" }).menu(), /scheduler--compact/);
  assert.match(schedulerVariants({ density: "comfortable" }).menuPopover(), /scheduler--comfortable/);
});
