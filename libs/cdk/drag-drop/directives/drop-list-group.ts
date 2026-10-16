// Ported from Angular Components (src/cdk/drag-drop/directives/drop-list-group.ts), MIT, © Google LLC.
// Rivet: `<DropListGroup>` renders `data-rv-drop-list-group` (+ `data-disabled`); the instance is DOM
// derived (its only input is `disabled`). `_items` holds the drop lists that registered so far;
// `_wakeAll()` creates the instances of every list of the group (Angular creates them with the view).
import { DROP_LIST_ATTR, DROP_LIST_GROUP_ATTR, groups, dropListOf } from "./registry.ts";

/**
 * Declaratively connects sibling `DropList` instances together. All of the `DropList`
 * elements that are placed inside a `DropListGroup` will be connected to each other
 * automatically. Can be used as an alternative to the `connectedTo` input of `DropList`.
 */
export class DropListGroupInstance<T = any> {
  /** Element of the group. */
  readonly element: HTMLElement;

  /** Drop lists registered inside the group. */
  readonly _items = new Set<T>();

  constructor(element: HTMLElement) {
    this.element = element;
  }

  /** Whether starting a dragging sequence from inside this group is disabled. */
  get disabled(): boolean {
    return this.element.hasAttribute("data-disabled");
  }

  /** Rivet: register every drop list of the group (they wake through their own handlers). */
  _wakeAll(): void {
    this.element.querySelectorAll(`[${DROP_LIST_ATTR}]`).forEach((list) => {
      if (groupElementOf(list) === this.element) dropListOf(list);
    });
  }

  /** Angular `ngOnDestroy`. */
  destroy(): void {
    this._items.clear();
    groups.delete(this.element);
  }
}

/**
 * The group element a drop list belongs to (Angular: `CDK_DROP_LIST_GROUP`, skipSelf — a drop list
 * provides `undefined` to its children, so a list nested in another list joins no outer group).
 */
export function groupElementOf(listElement: Element): HTMLElement | null {
  for (let node = listElement.parentElement; node; node = node.parentElement) {
    if (node.hasAttribute(DROP_LIST_GROUP_ATTR)) return node;
    if (node.hasAttribute(DROP_LIST_ATTR)) return null;
  }
  return null;
}

/** The group instance of a group element (created on first use). */
export function groupOf(element: HTMLElement): DropListGroupInstance {
  let group = groups.get(element);
  if (!group) groups.set(element, (group = new DropListGroupInstance(element)));
  return group;
}
