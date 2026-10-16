// Ported from react-aria-components `Breadcrumbs` / `Breadcrumb` (packages/react-aria-components/src/Breadcrumbs.tsx)
// and react-aria `useBreadcrumbs` (packages/react-aria/src/breadcrumbs/useBreadcrumbs.ts), Apache-2.0, © Adobe.
// Breadcrumbs display a hierarchy of links to the current page or resource: an `<ol>` collection of
// `<Breadcrumb>` parts; each provides `LinkContext` (`aria-current="page"` + disabled on the last one,
// `onAction(id)` on press) to the `<Link>` inside it.
// Rivet:
// - the collection is built (B5 `collectionOf`, build mode) so a Breadcrumb knows it is last (RAC
//   `node.nextKey == null`); `isCurrent` is read from that collection by key (an appended item moves it).
// - `items` + a render function (RAC dynamic collections) is the data-driven preset over the parts.
// - render props are accessors (`{({ isCurrent }) => (isCurrent() ? "Current" : name)}`); `class` = RAC
//   `className` (defaults `rv-Breadcrumbs` / `rv-Breadcrumb`); `isDisabled` may be an accessor.
// - Overflow (Rivet addition, React Spectrum v3 Breadcrumbs collapse; `../overflow/index.tsx`): `overflowMode="collapse"`
//   measures the `<ol>` and renders `[root?, overflow item, ...last]` (Spectrum `showRoot`, `maxVisibleItems`); the overflow
//   `<li>` holds `renderOverflow(hiddenItems)` (e.g. a "…" MenuTrigger). Default `overflowMode="wrap"` = RAC (no measuring).
// `render` (RAC DOMRenderProps) on Breadcrumbs (`<ol>`, renderProps `undefined`) and Breadcrumb (`<li>`, BreadcrumbRenderProps): given, the attributes object goes to `render` instead of the default element.
import { computed, createContext, provide, signal, untrack, useContext } from "@rivetjs/reactivity";
import { For, Provider as ContextProvider, ref as createRef, type Ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import {
  contextProps,
  resumableContext,
  slottedContext,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleProps,
} from "../slots/index.tsx";
import {
  Collection,
  CollectionRendererContext,
  DefaultCollectionRenderer,
  collectionOf,
  createLeafComponent,
  renderNodeAt,
  type CollectionProps,
} from "../collections/components.tsx";
import { mergeRefs } from "../interactions/merge-props.tsx";
import { OVERFLOW, createOverflow } from "../overflow/index.tsx";
import { CollectionNode } from "../collections/base.ts";
import type { Collection as ICollection, Key, Node } from "../collections/types.ts";
import type { AriaLabelingProps } from "../utils/types.ts";
import { LinkContext, type LinkProps } from "../link/index.tsx";
import { breadcrumbsProps, type AriaBreadcrumbsProps } from "./behaviour.ts";
import { hasLive, isLive, liveClass, liveOptions } from "../utils/live.tsx";
import { renderPropsOf } from "../slots/index.tsx";

export type { Key } from "../collections/types.ts";
export { breadcrumbsProps, type AriaBreadcrumbsProps } from "./behaviour.ts";

export interface BreadcrumbsProps<T>
  extends
    Omit<CollectionProps<T>, "idScope">,
    AriaBreadcrumbsProps,
    StyleProps,
    SlotProps,
    DOMRenderProps<"ol", undefined>,
    Omit<GlobalDOMAttributes<HTMLOListElement>, "style"> {
  /** @default 'rv-Breadcrumbs' */
  class?: string;
  /** Whether the breadcrumbs are disabled (may be an accessor). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** Handler that is called when a breadcrumb is clicked. */
  onAction?: (key: Key) => void;
  ref?: RefValue<HTMLOListElement>;
  /**
   * Rivet addition (React Spectrum Breadcrumbs collapsing, `overflowMode` name from Spectrum ActionGroup): `"collapse"`
   * measures the list and collapses the breadcrumbs that do not fit into one overflow item rendered by `renderOverflow`.
   * Read once at mount (it picks the collapsing implementation). @default 'wrap'
   */
  overflowMode?: "wrap" | "collapse";
  /** `overflowMode="collapse"`: always show the root item while it fits (Spectrum `showRoot`). Read once at mount (the overflow measurer's options). */
  showRoot?: boolean;
  /** `overflowMode="collapse"`: at most this many breadcrumbs stay visible, the overflow item included (Spectrum: 4). Read once at mount. @default 4 */
  maxVisibleItems?: number | "auto";
  /** `overflowMode="collapse"`: visible breadcrumbs before the browser measures (server render). Read once at mount. @default every item */
  defaultVisibleItems?: number;
  /** `overflowMode="collapse"`: the overflow item's content for the collapsed breadcrumbs (e.g. a "…" button opening a Menu). Inline arrow. */
  renderOverflow?: (items: BreadcrumbsOverflowItem[]) => Content;
  /** `overflowMode="collapse"`: class of the overflow `<li>`. @default 'rv-Breadcrumb' */
  overflowClass?: string;
}

/** A collapsed breadcrumb, as `renderOverflow` gets it. */
export interface BreadcrumbsOverflowItem {
  /** The Breadcrumb's `id` (pass it to `onAction`). */
  key: Key;
  /** The Breadcrumb's `textValue`, else its text as last rendered. */
  textValue: string;
  /** The Breadcrumb's `href` prop, else the href of the link it last rendered. */
  href: string | undefined;
  /** The Breadcrumb's props. */
  props: Record<string, unknown>;
}

/** RAC `BreadcrumbsContext` (slot props for the list; the Breadcrumbs re-provides `{ isDisabled, onAction }` to its items). */
export const BreadcrumbsContext = resumableContext(createContext<ContextValue<BreadcrumbsProps<any>, HTMLOListElement>>(null, { id: "rv-breadcrumbs" }));

/** Rivet: the built collection of the enclosing Breadcrumbs (a Breadcrumb's `isCurrent` reads it). */
const BreadcrumbsCollectionContext = resumableContext(createContext<(() => ICollection<Node<unknown>>) | null>(null, { id: "rv-breadcrumbs-collection" }));

/** Breadcrumbs display a hierarchy of links to the current page or resource in an application (RAC `Breadcrumbs`). */
export function Breadcrumbs<T>(inProps: BreadcrumbsProps<T>) {
  // Live props (P5): `isDisabled` becomes an accessor (every Breadcrumb reads it with `read`), a live `class` goes
  // through the spread; the rest of the body is read once (untracked).
  return untrack(() => breadcrumbs(inProps));
}

function breadcrumbs<T>(inProps: BreadcrumbsProps<T>) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, BreadcrumbsContext) as [BreadcrumbsProps<T>, RefValue<HTMLOListElement> | undefined];
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, ["isDisabled"]) : ctxProps;
  // A custom renderer comes from context; the default one is referenced by import (a captured module-level
  // object is not serializable on a resumed page).
  const renderer = useContext(CollectionRendererContext);
  const customRenderer = renderer === DefaultCollectionRenderer ? undefined : renderer;
  const items = props.items;
  const children = props.children;
  // Object-literal function value = a resumable symbol: the collection computed captures it, so a resumed
  // binding that reads the collection (Breadcrumb `isCurrent`) can rebuild it (a bare arrow argument is not).
  const build = { content: () => Collection<T>({ items, children }) };
  const collection = collectionOf(build.content);
  const nav = breadcrumbsProps(props);
  const dom = globalDOMProps(props, ["style"]);
  const slot = props.slot || undefined;
  const style = props.style;
  const className = isLive(props, "class") ? liveClass(props, "rv-Breadcrumbs") : (props.class ?? "rv-Breadcrumbs");
  dom.class = className;
  const itemsContext = { isDisabled: props.isDisabled, onAction: props.onAction };
  if (props.overflowMode === "collapse") return collapsingBreadcrumbs(props, ref, collection, nav, dom, slot, style, className, itemsContext);
  if (props.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      id: nav.id as string | undefined,
      "aria-label": nav["aria-label"] as string | undefined,
      "aria-labelledby": nav["aria-labelledby"] as string | undefined,
      "aria-describedby": nav["aria-describedby"] as string | undefined,
      "aria-details": nav["aria-details"] as string | undefined,
      slot: slot,
      style: style,
      class: className,
      children: () => (
        <ContextProvider token={BreadcrumbsContext} value={itemsContext}>
          <ContextProvider token={BreadcrumbsCollectionContext} value={collection}>
            {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection }) as never}
          </ContextProvider>
        </ContextProvider>
      ),
    };
    return props.render(attrs as never, undefined);
  }
  return (
    <ol
      {...dom}
      ref={ref as never}
      id={nav.id as string | undefined}
      aria-label={nav["aria-label"] as string | undefined}
      aria-labelledby={nav["aria-labelledby"] as string | undefined}
      aria-describedby={nav["aria-describedby"] as string | undefined}
      aria-details={nav["aria-details"] as string | undefined}
      slot={slot}
      style={style}
    >
      <ContextProvider token={BreadcrumbsContext} value={itemsContext}>
        <ContextProvider token={BreadcrumbsCollectionContext} value={collection}>
          {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection }) as never}
        </ContextProvider>
      </ContextProvider>
    </ol>
  );
}

const isServer = typeof document === "undefined";

/** Breadcrumbs with `overflowMode="collapse"` (React Spectrum v3 Breadcrumbs: `[root?, menu, ...last]`). */
function collapsingBreadcrumbs<T>(
  props: BreadcrumbsProps<T>,
  ref: RefValue<HTMLOListElement> | undefined,
  collection: () => ICollection<Node<unknown>>,
  nav: Record<string, unknown>,
  dom: Record<string, unknown>,
  slot: string | undefined,
  style: BreadcrumbsProps<T>["style"],
  className: unknown,
  itemsContext: Pick<BreadcrumbsProps<T>, "isDisabled" | "onAction">,
) {
  // The measured `<ol>`: the caller's `ref()` when it is one (resumes), else our own (merged in the browser).
  const own = typeof ref === "function" && "set" in ref;
  const listRef: Ref<HTMLOListElement> = own ? (ref as Ref<HTMLOListElement>) : createRef<HTMLOListElement>();
  const olRef = own || !ref ? listRef : isServer ? ref : (mergeRefs(ref as never, listRef as never) as RefValue<HTMLOListElement>);
  const renderOverflow = props.renderOverflow;
  const overflowClass = props.overflowClass ?? "rv-Breadcrumb";
  const keys = computed(() => {
    const out: Key[] = [];
    for (const node of collection()) if (node.type !== "content") out.push(node.key);
    return out;
  });
  // Text / href of every breadcrumb as last rendered (read while every item is shown): the collapsed ones are not in the DOM.
  const seen = signal<Record<string, { textValue: string; href: string | undefined }>>({});
  const overflow = createOverflow({
    ref: listRef,
    items: keys,
    collapse: "start",
    showRoot: props.showRoot,
    maxVisibleItems: props.maxVisibleItems,
    defaultVisibleItems: props.defaultVisibleItems,
    onMeasureAll: (elements) => {
      const all = untrack(keys);
      const record: Record<string, { textValue: string; href: string | undefined }> = {};
      elements.forEach((element, i) => {
        if (i < all.length)
          record[String(all[i])] = { textValue: (element.textContent ?? "").trim(), href: element.querySelector("a[href]")?.getAttribute("href") ?? undefined };
      });
      seen.set(record);
    },
  });
  const rows = overflow.items;
  const hidden = overflow.hidden;
  const hiddenItems = computed((): BreadcrumbsOverflowItem[] => {
    const c = collection();
    const last = seen();
    return hidden().map((key) => {
      const node = c.getItem(key);
      const nodeProps = (node?.props ?? {}) as Record<string, unknown>;
      const dom = last[String(key)];
      return { key, textValue: node?.textValue || dom?.textValue || "", href: (nodeProps.href as string | undefined) ?? dom?.href, props: nodeProps };
    });
  });
  if (props.render) {
    const attrs = {
      ...dom,
      ref: olRef as never,
      id: nav.id as string | undefined,
      "aria-label": nav["aria-label"] as string | undefined,
      "aria-labelledby": nav["aria-labelledby"] as string | undefined,
      "aria-describedby": nav["aria-describedby"] as string | undefined,
      "aria-details": nav["aria-details"] as string | undefined,
      slot: slot,
      style: style,
      class: className,
      children: () => (
        <ContextProvider token={BreadcrumbsContext} value={itemsContext}>
          <ContextProvider token={BreadcrumbsCollectionContext} value={collection}>
            <For each={rows} by={(key: Key) => key}>
              {(key: () => Key) =>
                untrack(key) === OVERFLOW ? (
                  <li class={overflowClass} data-overflow="true">
                    {renderOverflow?.(hiddenItems()) as never}
                  </li>
                ) : (
                  (renderNodeAt(collection, key) as never)
                )
              }
            </For>
          </ContextProvider>
        </ContextProvider>
      ),
    };
    return props.render(attrs as never, undefined);
  }
  return (
    <ol
      {...dom}
      ref={olRef as never}
      id={nav.id as string | undefined}
      aria-label={nav["aria-label"] as string | undefined}
      aria-labelledby={nav["aria-labelledby"] as string | undefined}
      aria-describedby={nav["aria-describedby"] as string | undefined}
      aria-details={nav["aria-details"] as string | undefined}
      slot={slot}
      style={style}
    >
      <ContextProvider token={BreadcrumbsContext} value={itemsContext}>
        <ContextProvider token={BreadcrumbsCollectionContext} value={collection}>
          <For each={rows} by={(key: Key) => key}>
            {(key: () => Key) =>
              untrack(key) === OVERFLOW ? (
                <li class={overflowClass} data-overflow="true">
                  {renderOverflow?.(hiddenItems()) as never}
                </li>
              ) : (
                (renderNodeAt(collection, key) as never)
              )
            }
          </For>
        </ContextProvider>
      </ContextProvider>
    </ol>
  );
}

export interface BreadcrumbRenderProps {
  /** Whether the breadcrumb is for the current page. `[data-current]` */
  isCurrent: () => boolean;
  /** Whether the breadcrumb is disabled. `[data-disabled]` */
  isDisabled: () => boolean;
}

export interface BreadcrumbProps
  extends
    RenderProps<BreadcrumbRenderProps>,
    DOMRenderProps<"li", BreadcrumbRenderProps>,
    AriaLabelingProps,
    Omit<GlobalDOMAttributes<HTMLLIElement>, "style"> {
  /** @default 'rv-Breadcrumb' */
  class?: RenderProps<BreadcrumbRenderProps>["class"];
  /** A unique id for the breadcrumb, which will be passed to `onAction` when the breadcrumb is pressed. */
  id?: Key;
  /** Rivet: the breadcrumb's text for the Breadcrumbs overflow item (`renderOverflow`); default: its text as rendered. */
  textValue?: string;
  ref?: RefValue<HTMLLIElement>;
}

/** RAC `BreadcrumbNode`. */
class BreadcrumbNode extends CollectionNode<unknown> {
  static override readonly type = "item";
}

/** A Breadcrumb represents an individual item in a `<Breadcrumbs>` list (RAC `Breadcrumb`). */
export const Breadcrumb = /*#__PURE__*/ createLeafComponent(BreadcrumbNode, function Breadcrumb(props: BreadcrumbProps, ref: unknown, node: Node<unknown>) {
  // Recreating useBreadcrumbItem because we want to use composition instead of having the link builtin.
  const key = node.key;
  const collection = useContext(BreadcrumbsCollectionContext);
  // Capture plain data only (never `node`, a class instance): the closures resume.
  const isLast = node.nextKey == null;
  const isCurrent = (): boolean => (collection ? collection().getItem(key)?.nextKey == null : isLast);
  const { isDisabled: listDisabled, onAction } = (slottedContext(BreadcrumbsContext) ?? {}) as Pick<BreadcrumbsProps<unknown>, "isDisabled" | "onAction">;
  const isDisabled = (): boolean => !!read(listDisabled) || isCurrent();
  const linkProps: LinkProps = {
    "aria-current": () => (isCurrent() ? "page" : undefined),
    isDisabled,
    onPress: () => onAction?.(key),
  };
  const rp = renderPropsOf(props, {
    values: { isDisabled, isCurrent },
    defaultClassName: "rv-Breadcrumb",
  });
  const dom = globalDOMProps(props, ["style"]);
  const ariaLabel = props["aria-label"];
  const labelledBy = props["aria-labelledby"];
  const describedBy = props["aria-describedby"];
  const details = props["aria-details"];
  if (props.render) {
    const attrs = {
      ...dom,
      ref: (props.ref ?? ref) as never,
      class: () => rp.class(),
      style: () => rp.style(),
      "aria-label": ariaLabel,
      "aria-labelledby": labelledBy,
      "aria-describedby": describedBy,
      "aria-details": details,
      "data-disabled": () => dataBool(isDisabled()),
      "data-current": () => dataBool(isCurrent()),
      children: () => (
        <ContextProvider token={LinkContext} value={linkProps as never}>
          {rp.children()}
        </ContextProvider>
      ),
    };
    return props.render(attrs as never, { isDisabled, isCurrent });
  }
  return (
    <li
      {...dom}
      ref={(props.ref ?? ref) as never}
      class={rp.class()}
      style={rp.style()}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-details={details}
      data-disabled={dataBool(isDisabled())}
      data-current={dataBool(isCurrent())}
    >
      {provide(LinkContext, linkProps as never, () => rp.children())}
    </li>
  );
});
