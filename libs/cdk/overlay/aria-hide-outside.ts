// Hide everything outside the given elements from assistive technology (React Aria
// `ariaHideOutside`): `aria-hidden="true"` (or `inert` with `shouldUseInert`) on the outermost
// elements that contain none of the targets, reference counted per element, with a
// MutationObserver hiding elements added later. Live announcers and top-layer content (toasts:
// `[data-rv-top-layer]`) stay visible. Nested calls stack: the newest observer is active.
// Shadow DOM: traverses open roots and observes enclosing roots up to the root tree.
// As upstream, default root / observer stack / mutation constructors remain global.
// The overlay layer uses it for every modal surface (modals, modal popovers, menus).
//
// Ported from @react-aria/overlays (ariaHideOutside.ts), Apache-2.0, © Adobe.

import { isShadowRoot } from "../utils/dom-core.ts";
import { createShadowTreeWalker } from "../utils/shadow-tree-walker.ts";

export interface AriaHideOutsideOptions {
  /** Nothing above this element is hidden. @default document.body */
  root?: Element;
  /** Use `inert` instead of `aria-hidden` (also blocks pointer and focus). */
  shouldUseInert?: boolean;
}

const ALWAYS_VISIBLE = "[data-rv-announcer], [data-rv-announcers], [data-live-announcer], [data-rv-top-layer], [data-react-aria-top-layer]";
const isAlwaysVisibleNode = (node: Element): boolean => node.matches(ALWAYS_VISIBLE);

// Hidden elements → how many calls hide them; aria-hidden is removed when it returns to 0.
let refCountMap = new WeakMap<Element, number>();
interface ObserverWrapper {
  visibleNodes: Set<Element>;
  hiddenNodes: Set<Element>;
  observe(): void;
  disconnect(): void;
}
const observerStack: ObserverWrapper[] = [];
// The next node up in `nodeContains`'s climb (slot → its parent, shadow root → host, else parent): `nodeContains(x, n)` ⇔
// `x` is `n` or on its climb. One climb per target / mutation replaces a containment scan per walked node × target
// (PERF-REST P6, our optimisation; upstream scans).
const up = (current: Node): Node | null => {
  const slotted = current as Node & { assignedSlot?: HTMLSlotElement | null; assignedElements?: unknown };
  if (typeof slotted.assignedElements !== "function" && slotted.assignedSlot?.parentNode) return slotted.assignedSlot.parentNode;
  return isShadowRoot(current) ? current.host : current.parentNode;
};

/** Hide everything outside `targets`; returns the function that restores it. */
export function ariaHideOutside(targets: Element[], options?: AriaHideOutsideOptions | Element): () => void {
  const windowObj = (targets?.[0]?.ownerDocument.defaultView ?? window) as Window & typeof globalThis;
  const opts: AriaHideOutsideOptions | undefined = options instanceof windowObj.Element ? { root: options } : (options as AriaHideOutsideOptions | undefined);
  const root = opts?.root ?? document.body;
  const supportsInert = "inert" in windowObj.HTMLElement.prototype;
  const shouldUseInert = opts?.shouldUseInert && supportsInert;
  const visibleNodes = new Set<Element>(targets);
  const hiddenNodes = new Set<Element>();

  const getHidden = (element: Element) =>
    shouldUseInert && element instanceof windowObj.HTMLElement ? element.inert : element.getAttribute("aria-hidden") === "true";
  const setHidden = (element: Element, hidden: boolean) => {
    if (shouldUseInert && element instanceof windowObj.HTMLElement) element.inert = hidden;
    else if (hidden) element.setAttribute("aria-hidden", "true");
    else {
      element.removeAttribute("aria-hidden");
      // Only called with false when the count reaches 0: visible again, so not inert either.
      if (element instanceof windowObj.HTMLElement) element.inert = false;
    }
  };

  // MutationObserver does not cross shadow boundaries. Watch every enclosing
  // shadow root up to the tree containing the explicit root (React Aria).
  const shadowRootsToWatch = new Set<ShadowRoot>();
  const boundary = root.getRootNode();
  for (const target of targets) {
    let current = target.getRootNode();
    while (isShadowRoot(current) && current !== boundary) {
      shadowRootsToWatch.add(current);
      current = current.host.getRootNode();
    }
  }

  const walk = (walkRoot: Element) => {
    // Live announcers and top-layer content stay visible.
    for (const element of walkRoot.querySelectorAll(ALWAYS_VISIBLE)) visibleNodes.add(element);
    // Every node containing a target (rebuilt per walk: `keepVisible` and mutations add targets between walks).
    const containing = new Set<Node>();
    for (const target of visibleNodes) for (let n: Node | null = target; n !== null && !containing.has(n); n = up(n)) containing.add(n);
    const acceptNode = (node: Element): number => {
      // Skip targets, announcers, and children of hidden nodes (aria-hidden is recursive) — except
      // children of role="row": VoiceOver on iOS does not hide rows (https://bugs.webkit.org/show_bug.cgi?id=222623).
      if (
        hiddenNodes.has(node) ||
        visibleNodes.has(node) ||
        (node.parentElement && hiddenNodes.has(node.parentElement) && node.parentElement.getAttribute("role") !== "row")
      )
        return NodeFilter.FILTER_REJECT;
      // Descend into nodes containing a target.
      if (containing.has(node)) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    };
    const walker = createShadowTreeWalker(walkRoot.ownerDocument, walkRoot, NodeFilter.SHOW_ELEMENT, { acceptNode: (node) => acceptNode(node as Element) });
    // The walker skips its root.
    const acceptRoot = acceptNode(walkRoot);
    if (acceptRoot === NodeFilter.FILTER_ACCEPT) hide(walkRoot);
    if (acceptRoot !== NodeFilter.FILTER_REJECT) {
      let node = walker.nextNode() as Element | null;
      while (node != null) {
        hide(node);
        node = walker.nextNode() as Element | null;
      }
    }
  };

  const hide = (node: Element) => {
    const refCount = refCountMap.get(node) ?? 0;
    // Hidden already, not by us: leave it.
    if (getHidden(node) && refCount === 0) return;
    if (refCount === 0) setHidden(node, true);
    hiddenNodes.add(node);
    refCountMap.set(node, refCount + 1);
  };

  // A previous call's observer pauses; this one takes over.
  if (observerStack.length) observerStack[observerStack.length - 1]!.disconnect();
  walk(root);

  // `change.target` is in a target or a hidden node (one climb, not a containment test per node).
  const inside = (target: Node): boolean => {
    for (let n: Node | null = target; n !== null; n = up(n)) if (visibleNodes.has(n as Element) || hiddenNodes.has(n as Element)) return true;
    return false;
  };
  const onMutation: MutationCallback = (changes) => {
    for (const change of changes) {
      if (change.type !== "childList") continue;
      // Added outside every target and every hidden node: hide the new children.
      if (change.target.isConnected && !inside(change.target)) {
        for (const node of change.addedNodes) {
          if ((node instanceof HTMLElement || node instanceof SVGElement) && isAlwaysVisibleNode(node)) visibleNodes.add(node);
          else if (node instanceof Element) walk(node);
        }
      }
      // As upstream, losing an enclosing host disconnects the main observer.
      for (const shadowRoot of shadowRootsToWatch) {
        if (!shadowRoot.isConnected) {
          observer.disconnect();
          break;
        }
      }
    }
  };
  const observer = new MutationObserver(onMutation);
  observer.observe(root, { childList: true, subtree: true });
  const shadowObservers = new Set<MutationObserver>();
  for (const shadowRoot of shadowRootsToWatch) {
    const shadowObserver = new MutationObserver(onMutation);
    shadowObserver.observe(shadowRoot, { childList: true, subtree: true });
    shadowObservers.add(shadowObserver);
  }

  const observerWrapper: ObserverWrapper = {
    visibleNodes,
    hiddenNodes,
    observe: () => observer.observe(root, { childList: true, subtree: true }),
    disconnect: () => observer.disconnect(),
  };
  observerStack.push(observerWrapper);

  return () => {
    observer.disconnect();
    for (const shadowObserver of shadowObservers) shadowObserver.disconnect();
    for (const node of hiddenNodes) {
      const count = refCountMap.get(node);
      if (count == null) continue;
      if (count === 1) {
        setHidden(node, false);
        refCountMap.delete(node);
      } else refCountMap.set(node, count - 1);
    }
    // Pop this observer and resume the previous one.
    if (observerWrapper === observerStack[observerStack.length - 1]) {
      observerStack.pop();
      if (observerStack.length) observerStack[observerStack.length - 1]!.observe();
    } else observerStack.splice(observerStack.indexOf(observerWrapper), 1);
  };
}

/** Keep `element` visible in the active `ariaHideOutside` (e.g. a nested overlay while it enters); returns the undo function. */
export function keepVisible(element: Element): (() => void) | undefined {
  const observer = observerStack[observerStack.length - 1];
  if (observer && !observer.visibleNodes.has(element)) {
    observer.visibleNodes.add(element);
    return () => {
      observer.visibleNodes.delete(element);
    };
  }
  return undefined;
}

/** Test hook: forget all reference counts. */
export function _resetAriaHideOutside(): void {
  refCountMap = new WeakMap();
  observerStack.length = 0;
}
