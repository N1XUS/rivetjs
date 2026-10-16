// RV2150: when Preact stops reading the private `useId` mask field (`tree.ts`), every island would get the same ids
// silently; the server adapter's one-time probe turns that into a loud render error. Simulated by a `tree.ts` whose
// mask never reaches Preact (own file: the mock replaces the module for this file only).
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { h } from "preact";
import type { IslandContext, SlotMark } from "@rivetjs/bridge/adapter";
import { adapter } from "../server.ts";
import { Counter } from "./fixtures/components.ts";

vi.mock("../tree.ts", () => ({ maskOf: (id: string) => [id, 0], islandElement: (component: never, props: never) => h(component, props) }));

test("a moved useId mask field fails every Preact island render with RV2150", () => {
  const mark = (name: string): SlotMark => ({ name, html: "<rivet-slot></rivet-slot>" });
  const ctx: IslandContext = { id: "i0", nonce: undefined, signal: new AbortController().signal, slot: mark };
  for (let i = 0; i < 2; i++)
    assert.throws(
      () => adapter.render(Counter as never, { count: 1 }, {}, ctx),
      /^Error: \[RV2150\] Preact useId mask not applied \(probe rendered <i>P0-0<\/i>\)/,
    );
});
