// Imperative portals and outlets (Angular CDK portal): a `Portal` is content that can be attached
// to a `PortalOutlet` somewhere else in the document. `ComponentPortal` = a Rivet component + props,
// `TemplatePortal` = a render function + context (Angular's TemplateRef), `DomPortal` = an existing
// element moved into the outlet and back. `DomPortalOutlet` renders into an element with the
// runtime's `mount`. Browser only (outlets render client-side); for server-visible content use the
// `<Portal>` component (`@rivetjs/cdk/portal`).
//
// Ported from @angular/cdk/portal (portal.ts, dom-portal-outlet.ts, portal-errors.ts), MIT, © Google LLC.
import { runWithOwner, type Owner } from "@rivetjs/reactivity";
import { mount, type DOMValue } from "@rivetjs/runtime/dom";

/** Attached view returned by an outlet (Angular `ComponentRef` / `EmbeddedViewRef`). */
export interface PortalViewRef<C = unknown> {
  /** Root nodes rendered into the outlet. */
  readonly rootNodes: Node[];
  /** Context (TemplatePortal) or props (ComponentPortal) it was rendered with. */
  readonly context: C | undefined;
  /** Destroy the view (dispose its owner, remove its nodes). */
  destroy(): void;
  /** Run `fn` when the view is destroyed. */
  onDestroy(fn: () => void): void;
  readonly destroyed: boolean;
}

export const throwNullPortalError = (): never => {
  throw Error("Must provide a portal to attach");
};
export const throwPortalAlreadyAttachedError = (): never => {
  throw Error("Host already has a portal attached");
};
export const throwPortalOutletAlreadyDisposedError = (): never => {
  throw Error("This PortalOutlet has already been disposed");
};
export const throwUnknownPortalTypeError = (): never => {
  throw Error("Attempting to attach an unknown Portal type. BasePortalOutlet accepts either a ComponentPortal, a TemplatePortal or a DomPortal.");
};
export const throwNullPortalOutletError = (): never => {
  throw Error("Attempting to attach a portal to a null PortalOutlet");
};
export const throwNoPortalAttachedError = (): never => {
  throw Error("Attempting to detach a portal that is not attached to a host");
};

/** Something a portal can be attached to. */
export interface PortalOutlet {
  attach(portal: Portal<unknown>): unknown;
  detach(): unknown;
  dispose(): void;
  hasAttached(): boolean;
}

/** Content that can be attached to a `PortalOutlet`. */
export abstract class Portal<T> {
  private _attachedHost: PortalOutlet | null = null;

  /** Attach to `host`. */
  attach(host: PortalOutlet): T {
    if (host == null) throwNullPortalOutletError();
    if (host.hasAttached()) throwPortalAlreadyAttachedError();
    this._attachedHost = host;
    return host.attach(this) as T;
  }

  /** Detach from the host it is attached to. */
  detach(): void {
    const host = this._attachedHost;
    if (host != null) {
      this._attachedHost = null;
      host.detach();
    } else throwNoPortalAttachedError();
  }

  /** Whether it is attached to a host. */
  get isAttached(): boolean {
    return this._attachedHost != null;
  }

  /** Set the host reference without attaching (outlets call this). */
  setAttachedHost(host: PortalOutlet | null): void {
    this._attachedHost = host;
  }
}

/** A component rendered into an outlet. `owner` (from `getOwner()`) keeps the caller's contexts. */
export class ComponentPortal<P = Record<string, unknown>> extends Portal<PortalViewRef<P>> {
  readonly component: (props: P) => unknown;
  props: P | undefined;
  owner: Owner | null | undefined;
  constructor(component: (props: P) => unknown, props?: P, owner?: Owner | null) {
    super();
    this.component = component;
    this.props = props;
    this.owner = owner;
  }
}

/** A render function (Angular `TemplateRef`) rendered into an outlet with an optional context. */
export class TemplatePortal<C = undefined> extends Portal<PortalViewRef<C>> {
  readonly template: (context: C) => unknown;
  context: C | undefined;
  owner: Owner | null | undefined;
  constructor(template: (context: C) => unknown, context?: C, owner?: Owner | null) {
    super();
    this.template = template;
    this.context = context;
    this.owner = owner;
  }

  /** Attach, optionally with a different context. */
  override attach(host: PortalOutlet, context: C | undefined = this.context): PortalViewRef<C> {
    this.context = context;
    return super.attach(host);
  }

  override detach(): void {
    this.context = undefined;
    return super.detach();
  }
}

/** An existing element moved into the outlet (and back to where it was on detach). */
export class DomPortal<T extends Element = HTMLElement> extends Portal<T> {
  readonly element: T;
  constructor(element: T) {
    super();
    this.element = element;
  }
}

/** Outlet base: attach bookkeeping and the dispose function of the attached content. */
export abstract class BasePortalOutlet implements PortalOutlet {
  protected _attachedPortal: Portal<unknown> | null = null;
  private _disposeFn: (() => void) | null = null;
  private _isDisposed = false;

  hasAttached(): boolean {
    return !!this._attachedPortal;
  }

  attach<P>(portal: ComponentPortal<P>): PortalViewRef<P>;
  attach<C>(portal: TemplatePortal<C>): PortalViewRef<C>;
  attach<T extends Element>(portal: DomPortal<T>): T;
  attach(portal: Portal<unknown>): unknown;
  attach(portal: Portal<unknown>): unknown {
    if (!portal) throwNullPortalError();
    if (this.hasAttached()) throwPortalAlreadyAttachedError();
    if (this._isDisposed) throwPortalOutletAlreadyDisposedError();
    if (portal instanceof ComponentPortal) {
      this._attachedPortal = portal;
      return this.attachComponentPortal(portal);
    }
    if (portal instanceof TemplatePortal) {
      this._attachedPortal = portal;
      return this.attachTemplatePortal(portal);
    }
    if (this.attachDomPortal && portal instanceof DomPortal) {
      this._attachedPortal = portal;
      return this.attachDomPortal(portal);
    }
    return throwUnknownPortalTypeError();
  }

  abstract attachComponentPortal<P>(portal: ComponentPortal<P>): PortalViewRef<P>;
  abstract attachTemplatePortal<C>(portal: TemplatePortal<C>): PortalViewRef<C>;
  attachDomPortal: null | ((portal: DomPortal<Element>) => unknown) = null;

  detach(): void {
    if (this._attachedPortal) {
      this._attachedPortal.setAttachedHost(null);
      this._attachedPortal = null;
    }
    this._invokeDisposeFn();
  }

  dispose(): void {
    if (this.hasAttached()) this.detach();
    this._invokeDisposeFn();
    this._isDisposed = true;
  }

  setDisposeFn(fn: () => void): void {
    this._disposeFn = fn;
  }

  private _invokeDisposeFn(): void {
    if (this._disposeFn) {
      this._disposeFn();
      this._disposeFn = null;
    }
  }
}

/** Render `render()` into `outlet` (in `owner`, for contexts) and wrap it as a view. */
function renderView<C>(outlet: Element, render: () => unknown, context: C | undefined, owner: Owner | null | undefined): PortalViewRef<C> {
  const before = outlet.lastChild;
  const stop = runWithOwner(owner ?? null, () => mount(render as () => DOMValue, outlet));
  const rootNodes: Node[] = [];
  for (let node = before ? before.nextSibling : outlet.firstChild; node; node = node.nextSibling) if (node.nodeType !== 8) rootNodes.push(node);
  const listeners: (() => void)[] = [];
  let destroyed = false;
  return {
    rootNodes,
    context,
    get destroyed() {
      return destroyed;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      for (const fn of listeners.splice(0)) fn();
    },
    onDestroy(fn) {
      listeners.push(fn);
    },
  };
}

/** An outlet rendering into an element (Angular `DomPortalOutlet`). Browser only. */
export class DomPortalOutlet extends BasePortalOutlet {
  readonly outletElement: Element;
  constructor(outletElement: Element) {
    super();
    this.outletElement = outletElement;
  }

  attachComponentPortal<P>(portal: ComponentPortal<P>): PortalViewRef<P> {
    const view = renderView(this.outletElement, () => portal.component(portal.props ?? ({} as P)), portal.props, portal.owner);
    this.setDisposeFn(() => view.destroy());
    this._attachedPortal = portal as Portal<unknown>;
    return view;
  }

  attachTemplatePortal<C>(portal: TemplatePortal<C>): PortalViewRef<C> {
    const view = renderView(this.outletElement, () => portal.template(portal.context as C), portal.context, portal.owner);
    this.setDisposeFn(() => view.destroy());
    this._attachedPortal = portal as Portal<unknown>;
    return view;
  }

  override attachDomPortal = (portal: DomPortal<Element>): Element => {
    const element = portal.element;
    if (!element.parentNode) throw Error("DOM portal content must be attached to a parent node.");
    // Anchor at the element's previous position, to put it back on detach.
    const anchorNode = this.outletElement.ownerDocument.createComment("dom-portal");
    element.parentNode.insertBefore(anchorNode, element);
    this.outletElement.appendChild(element);
    this._attachedPortal = portal as Portal<unknown>;
    super.setDisposeFn(() => {
      if (anchorNode.parentNode) anchorNode.parentNode.replaceChild(element, anchorNode);
    });
    return element;
  };

  /** Detach and remove the outlet element. */
  override dispose(): void {
    super.dispose();
    this.outletElement.remove();
  }
}
