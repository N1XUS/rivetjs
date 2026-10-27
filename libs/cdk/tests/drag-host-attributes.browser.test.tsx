// Host attributes of the drag-drop components. Upstream (Angular CDK) `cdkDrag` / `cdkDragHandle` / `cdkDropList` /
// `cdkDropListGroup` are directives: every attribute the template writes (`role`, `aria-*`) stays on the host element.
// The Rivet components render that element, so they forward `aria-*` and `role` with the global DOM props
// (`hostDOMProps`); a live (signal) value updates the attribute. Upstream has no spec for this (it is template
// behaviour), so these cases are Rivet's.
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Drag, DragHandle, DropList, DropListGroup } from "../drag-drop/index.tsx";

afterEach(cleanup);

const el = (container: Element, selector: string) => container.querySelector(selector) as HTMLElement;

describe("drag-drop host attributes", () => {
  it("Drag forwards role and aria-* to its element", () => {
    const { container } = render(() => (
      <Drag role="group" aria-label="Task a" aria-describedby="hint" aria-roledescription="draggable card" data-testid="d">
        a
      </Drag>
    ));
    const drag = el(container as Element, ".cdk-drag");
    expect(drag.getAttribute("role")).toBe("group");
    expect(drag.getAttribute("aria-label")).toBe("Task a");
    expect(drag.getAttribute("aria-describedby")).toBe("hint");
    expect(drag.getAttribute("aria-roledescription")).toBe("draggable card");
    expect(drag.getAttribute("data-testid")).toBe("d");
  });

  it("Drag keeps forwarding on every element type", () => {
    const { container } = render(() => (
      <ul>
        <Drag elementType="li" aria-label="Row" role="listitem">
          a
        </Drag>
      </ul>
    ));
    const drag = el(container as Element, "li.cdk-drag");
    expect(drag.getAttribute("aria-label")).toBe("Row");
    expect(drag.getAttribute("role")).toBe("listitem");
  });

  it("DragHandle forwards role and aria-* (any element type)", () => {
    const { container } = render(() => (
      <Drag>
        <DragHandle elementType="button" aria-label="Move task" aria-pressed="false">
          h
        </DragHandle>
        <DragHandle role="img" aria-label="Grip">
          g
        </DragHandle>
      </Drag>
    ));
    const [button, div] = [...(container as Element).querySelectorAll<HTMLElement>(".cdk-drag-handle")];
    expect(button!.tagName).toBe("BUTTON");
    expect(button!.getAttribute("aria-label")).toBe("Move task");
    expect(button!.getAttribute("aria-pressed")).toBe("false");
    expect(div!.getAttribute("role")).toBe("img");
    expect(div!.getAttribute("aria-label")).toBe("Grip");
  });

  it("DropList and DropListGroup forward role and aria-*", () => {
    const { container } = render(() => (
      <DropListGroup role="region" aria-label="Board">
        <DropList role="list" aria-labelledby="col-title">
          <Drag role="listitem">a</Drag>
        </DropList>
      </DropListGroup>
    ));
    const group = el(container as Element, "[data-rv-drop-list-group]");
    expect(group.getAttribute("role")).toBe("region");
    expect(group.getAttribute("aria-label")).toBe("Board");
    const list = el(container as Element, ".cdk-drop-list");
    expect(list.getAttribute("role")).toBe("list");
    expect(list.getAttribute("aria-labelledby")).toBe("col-title");
  });

  it("a live aria value updates the attribute", () => {
    const label = signal("Task a");
    const { container } = render(() => <Drag aria-label={label()}>a</Drag>);
    const drag = el(container as Element, ".cdk-drag");
    expect(drag.getAttribute("aria-label")).toBe("Task a");
    label.set("Task b");
    expect(drag.getAttribute("aria-label")).toBe("Task b");
  });

  it("non-attribute props are not forwarded", () => {
    const { container } = render(() => (
      <Drag {...({ ariaLabel: "x", roles: "y", lockAxis: "x" } as object)} aria-label="ok">
        a
      </Drag>
    ));
    const drag = el(container as Element, ".cdk-drag");
    expect(drag.getAttribute("aria-label")).toBe("ok");
    expect(drag.hasAttribute("arialabel")).toBe(false);
    expect(drag.hasAttribute("roles")).toBe(false);
    expect(drag.hasAttribute("lockaxis")).toBe(false);
  });
});
