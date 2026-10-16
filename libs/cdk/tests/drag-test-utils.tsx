// Ported from Angular Components (src/cdk/drag-drop/directives/test-utils.spec.ts), MIT, © Google LLC.
// Changes: `TestBed.createComponent(Type)` → `createComponent(Type, config)`: `Type` extends `TestComponent`,
// its `view()` is a Rivet TSX template rendered client-side (`@rivetjs/runtime/testing` `render`) inside the drag-drop config
// (`DragDropConfigContext`, Angular `CDK_DRAG_CONFIG`) and, when `config.dir` is given, a fake
// `DirectionalityContext` (Angular `provideFakeDirectionality`). The view renders on the first
// `detectChanges()`; after that Rivet bindings update synchronously, so later calls are no-ops.
import { provide } from "@rivetjs/reactivity";
import type { DOMValue } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { dispatchMouseEvent, dispatchTouchEvent } from "@rivetjs/testing/fake-events";
import { DirectionalityContext, createDir, type Direction, type Directionality, type DirState } from "../bidi/index.ts";
import { DragDropConfigContext, type DragDropConfig, type DropListOrientation } from "../drag-drop/directives/config.ts";

/** Options that can be used to configure a test. */
export interface DragDropTestConfig {
  dragDistance?: number;
  listOrientation?: DropListOrientation;
  /** Extra config merged over the defaults (Angular: extra `CDK_DRAG_CONFIG` providers). */
  dragConfig?: Partial<DragDropConfig>;
  /** Fake directionality (Angular `provideFakeDirectionality`). */
  dir?: Direction;
}

/**
 * Base of the Rivet fixtures (Angular `@Component` classes, same names): fields are the component's
 * state (signals for inputs that change after the first render), `view()` renders the template with
 * `this`, `host` is the fixture's container (set before `view()` runs; query `@ViewChild` elements in it).
 */
export abstract class TestComponent {
  host!: HTMLElement;
  abstract view(): DOMValue;
  /** `@ViewChild('name')` / `#name` refs: the element rendered with `data-ref="name"` (fixtures put it on a plain wrapper or pass `id`). */
  query<E extends Element = HTMLElement>(selector: string): E {
    return this.host.querySelector<E>(selector)!;
  }
  queryAll<E extends Element = HTMLElement>(selector: string): E[] {
    return [...this.host.querySelectorAll<E>(selector)];
  }
}

/** Angular `ComponentFixture`. */
export interface ComponentFixture<C> {
  componentInstance: C;
  nativeElement: HTMLElement;
  detectChanges(): void;
  destroy(): void;
}

/**
 * Creates a component fixture that can be used in a test.
 * @param componentType Component for which to create the fixture.
 * @param config Object that can be used to further configure the test.
 */
export function createComponent<C extends TestComponent>(componentType: new () => C, config: DragDropTestConfig = {}): ComponentFixture<C> {
  const dragConfig: DragDropConfig = {
    // We default the `dragDistance` to zero, because the majority of the tests
    // don't care about it and drags are a lot easier to simulate when we don't
    // have to deal with thresholds.
    dragStartThreshold: config?.dragDistance ?? 0,
    pointerDirectionChangeThreshold: 5,
    listOrientation: config.listOrientation,
    ...config.dragConfig,
  };
  const dir: Directionality | null = config.dir ? fakeDirectionality(config.dir) : null;
  // Upstream specs run in Karma, whose page keeps the default 8px body margin (some expected positions include it).
  document.body.style.margin = "8px";
  const instance = new componentType();
  const host = document.body.appendChild(document.createElement("div"));
  instance.host = host;
  let result: ReturnType<typeof render> | null = null;
  // Rendered on the first `detectChanges()` (Angular: the first change detection creates the view), so
  // a test can set fields of the instance first.
  const ensure = () =>
    (result ??= render(
      () => provide(DragDropConfigContext, dragConfig, () => (dir ? provide(DirectionalityContext, dir, () => instance.view()) : instance.view())),
      { container: host },
    ));
  fixtures.add(host);
  return {
    componentInstance: instance,
    get nativeElement() {
      ensure();
      return host;
    },
    detectChanges() {
      ensure();
    },
    destroy() {
      result?.unmount();
      host.remove();
    },
  };
}

const fixtures = new Set<HTMLElement>();

/** Angular `provideFakeDirectionality(value)`. */
export function fakeDirectionality(value: Direction): DirState {
  return createDir(value);
}

/** Unmounts every fixture (call from `afterEach`). */
export function destroyFixtures(): void {
  cleanup();
  fixtures.forEach((host) => host.remove());
  fixtures.clear();
}

/**
 * Drags an element to a position on the page using the mouse.
 * @param fixture Fixture on which to run change detection.
 * @param element Element which is being dragged.
 * @param x Position along the x axis to which to drag the element.
 * @param y Position along the y axis to which to drag the element.
 */
export function dragElementViaMouse(fixture: ComponentFixture<any>, element: Element, x: number, y: number) {
  startDraggingViaMouse(fixture, element);

  dispatchMouseEvent(document, "mousemove", x, y);
  fixture.detectChanges();

  dispatchMouseEvent(document, "mouseup", x, y);
  fixture.detectChanges();
}

/**
 * Dispatches the events for starting a drag sequence.
 * @param fixture Fixture on which to run change detection.
 * @param element Element on which to dispatch the events.
 * @param x Position along the x axis to which to drag the element.
 * @param y Position along the y axis to which to drag the element.
 */
export function startDraggingViaMouse(fixture: ComponentFixture<any>, element: Element, x?: number, y?: number) {
  dispatchMouseEvent(element, "mousedown", x, y);
  fixture.detectChanges();

  dispatchMouseEvent(document, "mousemove", x, y);
  fixture.detectChanges();
}

/**
 * Drags an element to a position on the page using a touch device.
 * @param fixture Fixture on which to run change detection.
 * @param element Element which is being dragged.
 * @param x Position along the x axis to which to drag the element.
 * @param y Position along the y axis to which to drag the element.
 */
export function dragElementViaTouch(fixture: ComponentFixture<any>, element: Element, x: number, y: number) {
  startDraggingViaTouch(fixture, element);
  continueDraggingViaTouch(fixture, x, y);
  stopDraggingViaTouch(fixture, x, y);
}

/**
 * @param fixture Fixture on which to run change detection.
 * @param element Element which is being dragged.
 */
export function startDraggingViaTouch(fixture: ComponentFixture<any>, element: Element) {
  dispatchTouchEvent(element, "touchstart");
  fixture.detectChanges();

  dispatchTouchEvent(document, "touchmove");
  fixture.detectChanges();
}

/**
 * @param fixture Fixture on which to run change detection.
 * @param x Position along the x axis to which to drag the element.
 * @param y Position along the y axis to which to drag the element.
 */
export function continueDraggingViaTouch(fixture: ComponentFixture<any>, x: number, y: number) {
  dispatchTouchEvent(document, "touchmove", x, y);
  fixture.detectChanges();
}

/**
 * @param fixture Fixture on which to run change detection.
 * @param x Position along the x axis to which to drag the element.
 * @param y Position along the y axis to which to drag the element.
 */
export function stopDraggingViaTouch(fixture: ComponentFixture<any>, x: number, y: number) {
  dispatchTouchEvent(document, "touchend", x, y);
  fixture.detectChanges();
}

/**
 * Adds a large element to the page in order to make it scrollable.
 * @returns Function that should be used to clean up after the test is done.
 */
export function makeScrollable(direction: "vertical" | "horizontal" = "vertical", element = document.body) {
  const veryTallElement = document.createElement("div");
  veryTallElement.style.width = direction === "vertical" ? "100%" : "4000px";
  veryTallElement.style.height = direction === "vertical" ? "2000px" : "5px";
  element.prepend(veryTallElement);
  scrollTo(0, 0);

  return () => {
    scrollTo(0, 0);
    veryTallElement.remove();
  };
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
