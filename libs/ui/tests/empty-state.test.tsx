// DOM-target suite: `EmptyState`: default text, custom children, data-slot, class, size.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { EmptyState, EmptyStateRoot, emptyStateVariants } = await import("../src/components/empty-state/index.ts");

test("empty-state: default text, class, data-slot", () => {
  const r = render(() => <EmptyState class="p-4" />);
  assert.equal(r.html(), '<div class="empty-state p-4" data-slot="empty-state">No results found</div>');
  r.unmount();
});

test("empty-state: custom children replace the default", () => {
  const r = render(() => (
    <EmptyState>
      <b>Nothing here</b>
    </EmptyState>
  ));
  assert.equal(r.container.querySelector("b")?.textContent, "Nothing here");
  assert.ok(!r.container.textContent?.includes("No results found"));
  r.unmount();
  const t = render(() => <EmptyState>Empty</EmptyState>);
  assert.equal(t.container.textContent, "Empty");
  t.unmount();
  assert.equal(EmptyState, EmptyStateRoot);
  assert.equal(emptyStateVariants(), "empty-state");
});

test("empty-state: size sm / md / lg (Rivet addition), live in place", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  assert.equal(emptyStateVariants({ size: "sm" }), "empty-state empty-state--sm");
  assert.equal(emptyStateVariants({ size: "md" }), "empty-state");
  assert.equal(emptyStateVariants({ size: "lg" }), "empty-state empty-state--lg");
  const size = signal<"sm" | "md" | "lg">("sm");
  const r = render(() => <EmptyState size={size()} />);
  const el = r.container.querySelector("[data-slot=empty-state]")!;
  assert.equal(el.className, "empty-state empty-state--sm");
  size.set("lg");
  assert.equal(r.container.querySelector("[data-slot=empty-state]"), el, "node kept");
  assert.equal(el.className, "empty-state empty-state--lg");
  r.unmount();
});
