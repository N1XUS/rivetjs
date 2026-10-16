// Ported from Angular Components (src/cdk/drag-drop/drag-drop.spec.ts), MIT, © Google LLC.
// Changes: `TestBed.inject(DragDrop)` → the `dragDrop` object; the test component's host element is a
// plain `<div>` in a happy-dom document (install-dom.ts); Jasmine globals from @rivetjs/testing/jasmine.
import { installDom } from "./install-dom.ts";
installDom();
import { beforeEach, describe, expect, it } from "@rivetjs/testing/jasmine";
const { dragDrop, DragRef, DropListRef } = await import("../drag-drop/cdk-index.tsx");
type DragDropService = import("../drag-drop/cdk-index.tsx").DragDropService;

describe("DragDrop", () => {
  let service: DragDropService;

  beforeEach(() => {
    service = dragDrop;
  });

  it("should be able to attach a DragRef to a DOM node", () => {
    const fixture = createTestComponent();
    const ref = service.createDrag(fixture.elementRef);

    expect(ref instanceof DragRef).toBe(true);
  });

  it("should be able to attach a DropListRef to a DOM node", () => {
    const fixture = createTestComponent();
    const ref = service.createDropList(fixture.elementRef);

    expect(ref instanceof DropListRef).toBe(true);
  });
});

/** `@Component({template: '<div></div>'}) class TestComponent { elementRef = inject(ElementRef) }`. */
function createTestComponent() {
  const host = document.body.appendChild(document.createElement("div"));
  host.appendChild(document.createElement("div"));
  return { elementRef: { nativeElement: host } };
}
