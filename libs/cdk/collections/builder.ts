// Ported from @react-stately/collections (Item.ts, Section.ts, CollectionBuilder.ts, useCollection.ts),
// Apache-2.0, © Adobe.
//
// Static and dynamic collection builders. React builds collections from `<Item>` / `<Section>`
// elements; Rivet evaluates JSX children eagerly into content, so collection elements are plain
// descriptors returned by calling the builder components as functions:
//
//   buildCollection({ children: [Item({ key: "a", children: "Apple" }), Section({ title: "Veg", children: [...] })] })
//   buildCollection({ items, children: (item) => Item({ key: item.id, children: item.name }) })
//
// The resulting nodes follow react-stately exactly (keys, `$.0` fallback keys, child key prefixing,
// levels, wrappers, `shouldInvalidate` caching, type constraints).
import type {
  Collection,
  CollectionBase,
  CollectionChildren,
  CollectionComponent,
  CollectionElement,
  CollectionStateBase,
  ItemProps,
  ItemRenderer,
  Key,
  Node,
  PartialNode,
  Rendered,
  SectionProps,
} from "./types.ts";
import { isSlot } from "@rivetjs/runtime/slot";

/** Whether `value` is a collection element (`Item(…)`, `Section(…)`, custom builder components). */
export function isCollectionElement(value: unknown): value is CollectionElement {
  return typeof value === "object" && value !== null && (value as { $$collection?: unknown }).$$collection === true;
}

/**
 * Define a builder component from a `getCollectionNode` generator (react-stately's static method).
 * Calling the component returns a collection element; `props.key` becomes the element key.
 */
export function defineCollectionComponent<P extends { key?: Key | undefined }, T = unknown>(
  getCollectionNode: (props: P, context: any) => Generator<PartialNode<T>, void, Node<T>[]>,
): CollectionComponent<T, P> {
  const component = ((props: P): CollectionElement<T, P> => {
    const { key = null, ...rest } = props as P & { key?: Key | null };
    return { $$collection: true, type: component, key, props: rest as P };
  }) as CollectionComponent<T, P>;
  component.getCollectionNode = getCollectionNode;
  return component;
}

/** React.Children.forEach equivalent: flattens arrays, skips null / undefined / booleans. */
export function forEachChild(children: unknown, fn: (child: any) => void): void {
  // Plain JSX children arrive as a compiler slot (lazy thunk): resolve it here, once.
  if (isSlot(children)) forEachChild(children(), fn);
  else if (Array.isArray(children)) for (const child of children) forEachChild(child, fn);
  else if (children != null && typeof children !== "boolean") fn(children);
}

/** React.Children.count equivalent. */
export function countChildren(children: unknown): number {
  let n = 0;
  forEachChild(children, () => n++);
  return n;
}

function hasChildItems<T>(props: ItemProps<T>): boolean {
  if (props.hasChildItems != null) return props.hasChildItems;
  if (props.childItems) return true;
  if (props.title && countChildren(props.children) > 0) return true;
  return false;
}

/**
 * Item / Section are generic in React (`<Item<T>>`); elements they return are assignable to any
 * collection's children, like untyped JSX elements.
 */
export interface GenericCollectionComponent<P> extends CollectionComponent<any, P> {
  (props: P): CollectionElement<any, P>;
}

/** An item in a collection (static: `Item({ key, children })`; dynamic: from a renderer). */
export const Item: GenericCollectionComponent<ItemProps<any>> = /* @__PURE__ */ defineCollectionComponent<ItemProps<any>, any>(function* getCollectionNode<T>(
  props: ItemProps<T>,
  context: any,
): Generator<PartialNode<T>, void, Node<T>[]> {
  const { childItems, title, children } = props;
  const rendered = props.title || props.children;
  const textValue = props.textValue || (typeof rendered === "string" ? rendered : "") || props["aria-label"] || "";
  // suppressTextValueWarning is used in components like Tabs, which don't have type to select support.
  if (!textValue && !context?.suppressTextValueWarning && isDev()) {
    console.warn("<Item> with non-plain text contents is unsupported by type to select for accessibility. Please add a `textValue` prop.");
  }
  yield {
    type: "item",
    props,
    rendered,
    textValue,
    "aria-label": props["aria-label"],
    hasChildNodes: hasChildItems(props),
    *childNodes() {
      if (childItems) {
        for (const child of childItems) yield { type: "item", value: child };
      } else if (title) {
        const items: PartialNode<T>[] = [];
        forEachChild(children, (child) => items.push({ type: "item", element: child as CollectionElement<T> }));
        yield* items;
      }
    },
  };
});

/** A section (group) of items. */
export const Section: GenericCollectionComponent<SectionProps<any>> = /* @__PURE__ */ defineCollectionComponent<SectionProps<any>, any>(
  function* getCollectionNode<T>(props: SectionProps<T>): Generator<PartialNode<T>, void, Node<T>[]> {
    const { children, title, items } = props;
    yield {
      type: "section",
      props,
      hasChildNodes: true,
      rendered: title,
      "aria-label": props["aria-label"],
      *childNodes() {
        if (typeof children === "function" && !isSlot(children)) {
          if (!items) throw new Error("props.children was a function but props.items is missing");
          for (const item of items) yield { type: "item", value: item, renderer: children as ItemRenderer<T> };
        } else {
          const list: PartialNode<T>[] = [];
          forEachChild(children, (child) => list.push({ type: "item", element: child }));
          yield* list;
        }
      },
    };
  },
);

const isDev = (): boolean => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV === "development";

interface CollectionBuilderState {
  renderer?: ItemRenderer<any> | undefined;
}

type Wrapper = (element: Rendered) => Rendered;

/** Builds collection nodes from collection elements / items + renderer (react-stately `CollectionBuilder`). */
export class CollectionBuilder<T extends object> {
  private context?: unknown;
  private cache: WeakMap<T, Node<T>> = new WeakMap();

  build(props: Partial<CollectionBase<T>>, context?: unknown): Iterable<Node<T>> {
    this.context = context;
    return iterable(() => this.iterateCollection(props));
  }

  private *iterateCollection(props: Partial<CollectionBase<T>>): Generator<Node<T>> {
    const { children, items } = props;
    if (typeof children === "function" && !isSlot(children)) {
      if (!items) throw new Error("props.children was a function but props.items is missing");
      let index = 0;
      for (const item of items) {
        yield* this.getFullNode({ value: item, index }, { renderer: children });
        index++;
      }
    } else {
      const elements: CollectionElement<T>[] = [];
      forEachChild(children, (child) => {
        if (child) elements.push(child);
      });
      let index = 0;
      for (const item of elements) {
        const nodes = this.getFullNode({ element: item, index }, {});
        for (const node of nodes) {
          index++;
          yield node;
        }
      }
    }
  }

  private getKey(item: CollectionElement<T>, partialNode: PartialNode<T>, _state: CollectionBuilderState, parentKey?: Key | null): Key {
    if (item.key != null) return item.key;
    if (partialNode.type === "cell" && partialNode.key != null) return `${parentKey}${partialNode.key}`;
    const v = partialNode.value as any;
    if (v != null) {
      const key = v.key ?? v.id;
      if (key == null) throw new Error("No key found for item");
      return key;
    }
    return parentKey ? `${parentKey}.${partialNode.index}` : `$.${partialNode.index}`;
  }

  private getChildState(state: CollectionBuilderState, partialNode: PartialNode<T>): CollectionBuilderState {
    return { renderer: partialNode.renderer || state.renderer };
  }

  private *getFullNode(
    partialNode: PartialNode<T> & { index: number },
    state: CollectionBuilderState,
    parentKey?: Key | null,
    parentNode?: Node<T>,
  ): Generator<Node<T>> {
    // Fragments: arrays of elements.
    if (Array.isArray(partialNode.element)) {
      const children: CollectionElement<T>[] = [];
      forEachChild(partialNode.element, (child) => children.push(child));
      let index = partialNode.index ?? 0;
      for (const child of children) yield* this.getFullNode({ element: child, index: index++ }, state, parentKey, parentNode);
      return;
    }

    // If there's a value instead of an element on the node, and a parent renderer function is
    // available, use it to render an element for the value.
    let element = partialNode.element;
    if (!element && partialNode.value && state && state.renderer) {
      const cached = this.cache.get(partialNode.value);
      if (cached && (!cached.shouldInvalidate || !cached.shouldInvalidate(this.context))) {
        cached.index = partialNode.index;
        cached.parentKey = parentNode ? parentNode.key : null;
        yield cached;
        return;
      }
      element = state.renderer(partialNode.value);
    }

    // An element with a getCollectionNode function on its type is a supported component. Call it to
    // get a partial node, and recursively build a full node from there.
    if (isCollectionElement(element)) {
      const type = element.type as CollectionComponent<T>;
      if (typeof type !== "function" || typeof type.getCollectionNode !== "function") {
        throw new Error(`Unknown element <${String((type as { name?: string }).name)}> in collection.`);
      }
      const childNodes = type.getCollectionNode(element.props, this.context);
      let index = partialNode.index ?? 0;
      let result = childNodes.next();
      while (!result.done && result.value) {
        const childNode = result.value;
        partialNode.index = index;
        let nodeKey = childNode.key ?? null;
        if (nodeKey == null) nodeKey = childNode.element ? null : this.getKey(element, partialNode, state, parentKey);
        const nodes = this.getFullNode(
          { ...childNode, key: nodeKey, index, wrapper: compose(partialNode.wrapper, childNode.wrapper) },
          this.getChildState(state, childNode),
          parentKey ? `${parentKey}${element.key}` : element.key,
          parentNode,
        );
        const children = [...nodes];
        for (const node of children) {
          // Cache the node based on its value.
          node.value = childNode.value ?? partialNode.value ?? null;
          if (node.value) this.cache.set(node.value, node);
          // The partial node may have specified a type for the child in order to specify a
          // constraint. Verify that the full node that was built recursively matches this type.
          if (partialNode.type && node.type !== partialNode.type) {
            throw new Error(
              `Unsupported type <${capitalize(node.type)}> in <${capitalize(parentNode?.type ?? "unknown parent type")}>. Only <${capitalize(partialNode.type)}> is supported.`,
            );
          }
          index++;
          yield node;
        }
        result = childNodes.next(children);
      }
      return;
    }

    // Ignore invalid elements.
    if (partialNode.key == null || partialNode.type == null) return;

    // Create full node.
    const builder = this;
    const node: Node<T> = {
      type: partialNode.type,
      props: partialNode.props,
      key: partialNode.key,
      parentKey: parentNode ? parentNode.key : null,
      value: partialNode.value ?? null,
      level: (parentNode?.level ?? 0) + (parentNode?.type === "item" ? 1 : 0),
      index: partialNode.index,
      rendered: partialNode.rendered,
      textValue: partialNode.textValue ?? "",
      "aria-label": partialNode["aria-label"],
      wrapper: partialNode.wrapper,
      shouldInvalidate: partialNode.shouldInvalidate,
      hasChildNodes: partialNode.hasChildNodes || false,
      childNodes: iterable(function* () {
        if (!partialNode.hasChildNodes || !partialNode.childNodes) return;
        let index = 0;
        for (const child of partialNode.childNodes()) {
          // Ensure child keys are globally unique by prepending the parent node's key.
          if (child.key != null) child.key = `${node.key}${child.key}`;
          const nodes = builder.getFullNode({ ...child, index }, builder.getChildState(state, child), node.key, node);
          for (const n of nodes) {
            index++;
            yield n;
          }
        }
      }),
    };
    yield node;
  }
}

/** Wraps an iterator function as an iterable object, and caches the results. */
function iterable<T>(iterator: () => IterableIterator<Node<T>>): Iterable<Node<T>> {
  const cache: Node<T>[] = [];
  let it: IterableIterator<Node<T>> | null = null;
  return {
    *[Symbol.iterator]() {
      for (const item of cache) yield item;
      if (!it) it = iterator();
      for (const item of it) {
        cache.push(item);
        yield item;
      }
    },
  };
}

function compose(outer: Wrapper | void, inner: Wrapper | void): Wrapper | undefined {
  if (outer && inner) return (element) => outer(inner(element));
  if (outer) return outer;
  if (inner) return inner;
  return undefined;
}

function capitalize(str: string): string {
  return str[0]!.toUpperCase() + str.slice(1);
}

export interface CollectionOptions<T, C extends Collection<Node<T>>> extends Omit<CollectionStateBase<T, C>, "children"> {
  children?: CollectionChildren<T> | undefined;
}

export type CollectionFactory<T, C extends Collection<Node<T>>> = (nodes: Iterable<Node<T>>) => C;

/**
 * Build a collection from props (react-stately `useCollection`): `collection` if given, else
 * `factory(builder.build({ children, items }, context))`.
 */
export function createCollection<T, C extends Collection<Node<T>> = Collection<Node<T>>>(
  props: CollectionOptions<T, C>,
  factory: CollectionFactory<T, C>,
  context?: unknown,
  builder: CollectionBuilder<any> = new CollectionBuilder(),
): C {
  if (props.collection) return props.collection;
  return factory(builder.build({ children: props.children ?? null, items: props.items }, context));
}
