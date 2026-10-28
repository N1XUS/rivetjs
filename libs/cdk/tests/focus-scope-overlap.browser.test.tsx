// Rapid popover changes can leave portaled child scopes alive while their parent's exit ends.
import { expect, it } from "vitest";
import { mountScope, isElementInChildOfActiveScope } from "../focus/focus-scope.tsx";

it("keeps the active portaled child when its former parent unmounts during overlapping exits", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const make = (id: string, parent?: string) => {
    const scope = document.createElement("div");
    scope.setAttribute("data-rv-focus-scope", id);
    scope.setAttribute("data-rv-contain", "");
    if (parent) scope.setAttribute("data-rv-focus-parent", parent);
    const input = document.createElement("input");
    scope.append(input);
    host.append(scope);
    const dispose = mountScope({ scope, contain: true, restoreFocus: true, autoFocus: true, nodeToRestore: null, resumed: false });
    return { scope, input, dispose };
  };
  const parent = make("parent");
  const first = make("first", "parent");
  const active = make("active", "parent");
  let parentDisposed = false;
  try {
    expect(document.activeElement === active.input).toBe(true);
    parent.dispose();
    parentDisposed = true;
    parent.scope.remove();
    // Check before inducing another focus event: the broken tree lets both remaining scopes
    // pull focus back to their own input recursively until the browser exhausts its stack.
    expect(isElementInChildOfActiveScope(first.input)).toBe(false);
    first.input.focus();
    expect(document.activeElement === active.input).toBe(true);
  } finally {
    active.dispose();
    first.dispose();
    if (!parentDisposed) parent.dispose();
    host.remove();
  }
});
