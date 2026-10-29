import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { Button } from "@rivetjs/cdk/button";
import { useDragAndDrop } from "@rivetjs/cdk/dnd";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";

export function Trees() {
  const { dragAndDropHooks } = useDragAndDrop({ getItems: () => [{ "text/plain": "Document" }] });
  const customHooks = {
    ...dragAndDropHooks,
    useDraggableItem: (props, state) => {
      const item = dragAndDropHooks.useDraggableItem(props, state);
      return {
        ...item,
        dragButtonProps: { ...item.dragButtonProps, "aria-describedby": () => "custom-description" },
      };
    },
  };
  const customUndefinedHooks = {
    ...dragAndDropHooks,
    useDraggableItem: (props, state) => {
      const item = dragAndDropHooks.useDraggableItem(props, state);
      return { ...item, dragButtonProps: { ...item.dragButtonProps, "aria-describedby": undefined } };
    },
  };
  return <>
    <Tree aria-label="First tree" dragAndDropHooks={dragAndDropHooks}>
      <TreeItem id="document" textValue="Document">
        <TreeItemContent><Button slot="drag">Drag</Button><span>Document</span></TreeItemContent>
      </TreeItem>
    </Tree>
    <Tree aria-label="Second tree" dragAndDropHooks={dragAndDropHooks}>
      <TreeItem id="document" textValue="Document" render={(attrs) => <div {...attrs} />}>
        <TreeItemContent><Button slot="drag">Drag</Button><span>Document</span></TreeItemContent>
      </TreeItem>
    </Tree>
    <Tree aria-label="Disabled tree" disabledKeys={["document"]} dragAndDropHooks={dragAndDropHooks}>
      <TreeItem id="document" textValue="Document">
        <TreeItemContent><Button slot="drag">Drag</Button><span>Document</span></TreeItemContent>
      </TreeItem>
    </Tree>
    <Tree aria-label="Custom hook tree" dragAndDropHooks={customHooks}>
      <TreeItem id="document" textValue="Document">
        <TreeItemContent>
          <Button slot="drag">Drag</Button><span>Document</span>
          <div id="custom-description" hidden>Custom drag instructions</div>
        </TreeItemContent>
      </TreeItem>
    </Tree>
    <Tree aria-label="Custom undefined hook tree" dragAndDropHooks={customUndefinedHooks}>
      <TreeItem id="document" textValue="Document">
        <TreeItemContent><Button slot="drag">Drag</Button><span>Document</span></TreeItemContent>
      </TreeItem>
    </Tree>
  </>;
}
`;

describe("Tree drag instructions on the server", () => {
  it("renders an instruction target per enabled row with unique IDs across trees and both row render branches", async () => {
    const { Trees } = await importModule<{ Trees(): unknown }>("tree-dnd-ssr-fixture.tsx", source);
    const html = await renderHtml(() => Trees());
    const window = new Window();
    window.document.body.innerHTML = html;
    const buttons = [...window.document.querySelectorAll('button[slot="drag"]')];
    expect(buttons).toHaveLength(5);
    const ids = buttons.slice(0, 2).map((button) => button.getAttribute("aria-describedby"));
    expect(ids.every((id) => !!id)).toBe(true);
    expect(new Set(ids).size).toBe(2);
    for (const [index, id] of ids.entries()) {
      const description = window.document.getElementById(id!);
      expect(description?.hasAttribute("hidden")).toBe(true);
      expect(description?.textContent).toContain("drag");
      expect(description?.closest('[role="gridcell"]')?.parentElement).toBe(buttons[index]!.closest('[role="row"]'));
      expect(window.document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
    }
    expect(buttons[2]!.getAttribute("aria-describedby")).toBeNull();
    expect(buttons[3]!.getAttribute("aria-describedby")).toBe("custom-description");
    expect(window.document.getElementById("custom-description")?.textContent).toBe("Custom drag instructions");
    expect(buttons[4]!.getAttribute("aria-describedby")).toBeNull();
    expect(buttons[4]!.closest('[role="row"]')?.querySelector('[id$="-drag-description"]')).toBeNull();
    expect(window.document.querySelector("script[data-boot]")).toBeNull();
    await window.happyDOM.close();
  });
});
