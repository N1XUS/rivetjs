// Types of revalidation by key, checked by `tsc -p libs/router` (typecheck gate): `event.depends()`
// on every RequestEvent, `invalidate()` / `revalidate()` overloads (fresh data, key, keys, predicate).
import { test } from "vitest";
import assert from "node:assert/strict";
import type { RequestEvent } from "../server/handler.ts";
import { load } from "../shared/server-exports.ts";
// Type-only: navigate.ts reaches the router client (index.ts, `.tsx` imports) that plain Node cannot load.
import type * as nav from "../client/navigate.ts";
import type { FreshData, InvalidateTarget } from "../client/navigate.ts";
declare const invalidate: typeof nav.invalidate, revalidate: typeof nav.revalidate;

export const loader = load((event: RequestEvent<{ id: string }>) => {
  event.depends("cart");
  event.depends("/api/items/" + event.params.id, new URL("https://api.test/user"));
  // @ts-expect-error keys are strings or URLs
  event.depends(1);
  return { id: event.params.id };
});

export const calls = (): Promise<void>[] => [
  invalidate(),
  invalidate("cart"),
  invalidate(new URL("https://api.test/user")),
  invalidate(["cart", new URL("https://api.test/user")]),
  invalidate((key: string) => key.startsWith("/api/")),
  invalidate({ data: [1], head: { title: "t" }, deps: [["cart"], undefined] } satisfies FreshData),
  revalidate("cart"),
  // @ts-expect-error predicates get the key string and answer a boolean
  invalidate((key: number) => key > 1),
  // @ts-expect-error keys are strings or URLs
  invalidate(1),
];
const target: InvalidateTarget = (key) => key === "cart";
export { target };

test("depends / invalidate types (checked by tsc)", () => {
  assert.equal(typeof calls, "function");
});
