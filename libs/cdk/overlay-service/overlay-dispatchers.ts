// Document-level event dispatchers of attached overlays (Angular CDK): `OverlayKeyboardDispatcher`
// sends a keydown to the top-most overlay that listens to `keydownEvents()` (even when focus stays on
// a trigger: select, autocomplete); `OverlayOutsideClickDispatcher` sends clicks outside overlays to
// `outsidePointerEvents()`, top-most first, stopping at the overlay the click is inside (origin =
// the pointerdown target, so a drag from inside to outside is not outside). Global listeners only
// while overlays are attached.
//
// Ported from @angular/cdk/overlay (dispatchers/*.ts), MIT, © Google LLC.
import { isIOS } from "../platform/index.ts";
import type { EventStream } from "./overlay-viewport.ts";

/** What dispatchers need from an `OverlayRef`. */
export interface DispatchedOverlay {
  readonly overlayElement: HTMLElement;
  readonly eventPredicate: ((event: Event) => boolean) | null;
  readonly _keydownEvents: EventStream<KeyboardEvent>;
  readonly _outsidePointerEvents: EventStream<MouseEvent>;
  hasAttached(): boolean;
}

export abstract class BaseOverlayDispatcher {
  /** Attached overlays, bottom first. */
  _attachedOverlays: DispatchedOverlay[] = [];
  protected _document: Document;
  protected _isAttached = false;

  constructor(document_: Document = document) {
    this._document = document_;
  }

  ngOnDestroy(): void {
    this.detach();
  }

  /** Add an overlay (moves it to the top if present). */
  add(overlayRef: DispatchedOverlay): void {
    this.remove(overlayRef);
    this._attachedOverlays.push(overlayRef);
  }

  /** Remove an overlay; the global listener goes with the last one. */
  remove(overlayRef: DispatchedOverlay): void {
    const index = this._attachedOverlays.indexOf(overlayRef);
    if (index > -1) this._attachedOverlays.splice(index, 1);
    if (this._attachedOverlays.length === 0) this.detach();
  }

  protected abstract detach(): void;

  /** Whether `overlayRef` takes `event`: it has subscribers and its predicate (if any) accepts it. */
  protected canReceiveEvent<T>(overlayRef: DispatchedOverlay, event: Event, stream: EventStream<T>): boolean {
    if (!stream.observed) return false;
    if (overlayRef.eventPredicate) return overlayRef.eventPredicate(event);
    return true;
  }
}

export class OverlayKeyboardDispatcher extends BaseOverlayDispatcher {
  private _cleanupKeydown: (() => void) | undefined;

  override add(overlayRef: DispatchedOverlay): void {
    super.add(overlayRef);
    if (!this._isAttached) {
      const body = this._document.body;
      body.addEventListener("keydown", this._keydownListener);
      this._cleanupKeydown = () => body.removeEventListener("keydown", this._keydownListener);
      this._isAttached = true;
    }
  }

  protected detach(): void {
    if (this._isAttached) {
      this._cleanupKeydown?.();
      this._isAttached = false;
    }
  }

  private _keydownListener = (event: KeyboardEvent): void => {
    const overlays = this._attachedOverlays;
    // The most recent overlay with keydown subscribers, not the one focus is in (select /
    // autocomplete keep focus on the trigger); overlays without subscribers do not block lower ones.
    for (let i = overlays.length - 1; i > -1; i--) {
      const overlayRef = overlays[i]!;
      if (this.canReceiveEvent(overlayRef, event, overlayRef._keydownEvents)) {
        overlayRef._keydownEvents.next(event);
        break;
      }
    }
  };
}

const eventTarget = <T extends EventTarget>(event: Event): T | null => (event.composedPath ? (event.composedPath()[0] as T) : (event.target as T | null));

export class OverlayOutsideClickDispatcher extends BaseOverlayDispatcher {
  private _cursorOriginalValue = "";
  private _cursorStyleIsSet = false;
  private _pointerDownEventTarget: HTMLElement | null = null;
  private _cleanups: (() => void)[] | undefined;

  override add(overlayRef: DispatchedOverlay): void {
    super.add(overlayRef);
    if (!this._isAttached) {
      const body = this._document.body;
      const listen = (type: string, fn: (event: never) => void) => {
        body.addEventListener(type, fn as EventListener, { capture: true });
        return () => body.removeEventListener(type, fn as EventListener, { capture: true });
      };
      this._cleanups = [
        listen("pointerdown", this._pointerDownListener),
        listen("click", this._clickListener),
        listen("auxclick", this._clickListener),
        listen("contextmenu", this._clickListener),
      ];
      // iOS Safari fires no click on non-interactive elements unless the body looks clickable.
      if (isIOS() && !this._cursorStyleIsSet) {
        this._cursorOriginalValue = body.style.cursor;
        body.style.cursor = "pointer";
        this._cursorStyleIsSet = true;
      }
      this._isAttached = true;
    }
  }

  protected detach(): void {
    if (this._isAttached) {
      this._cleanups?.forEach((cleanup) => cleanup());
      this._cleanups = undefined;
      if (isIOS() && this._cursorStyleIsSet) {
        this._document.body.style.cursor = this._cursorOriginalValue;
        this._cursorStyleIsSet = false;
      }
      this._isAttached = false;
    }
  }

  private _pointerDownListener = (event: PointerEvent): void => {
    this._pointerDownEventTarget = eventTarget<HTMLElement>(event);
  };

  private _clickListener = (event: MouseEvent): void => {
    const target = eventTarget<HTMLElement>(event);
    // A click's origin is the preceding pointerdown target (pressed inside, released outside: not
    // outside); programmatic clicks have none.
    const origin = event.type === "click" && this._pointerDownEventTarget ? this._pointerDownEventTarget : target;
    this._pointerDownEventTarget = null;
    // Copy: listeners may detach overlays meanwhile.
    const overlays = this._attachedOverlays.slice();
    // Top-most first; stop at the overlay the click is inside.
    for (let i = overlays.length - 1; i > -1; i--) {
      const overlayRef = overlays[i]!;
      const outsidePointerEvents = overlayRef._outsidePointerEvents;
      if (!overlayRef.hasAttached() || !this.canReceiveEvent(overlayRef, event, outsidePointerEvents)) continue;
      if (containsPierceShadowDom(overlayRef.overlayElement, target) || containsPierceShadowDom(overlayRef.overlayElement, origin)) break;
      outsidePointerEvents.next(event);
    }
  };
}

function containsPierceShadowDom(parent: HTMLElement, child: HTMLElement | null): boolean {
  let current: Node | null = child;
  while (current) {
    if (current === parent) return true;
    current = typeof ShadowRoot !== "undefined" && current instanceof ShadowRoot ? current.host : current.parentNode;
  }
  return false;
}

let keyboard: OverlayKeyboardDispatcher | undefined, outside: OverlayOutsideClickDispatcher | undefined;
/** The shared keyboard dispatcher (created on first use). */
export const overlayKeyboardDispatcher = (): OverlayKeyboardDispatcher => (keyboard ??= new OverlayKeyboardDispatcher());
/** The shared outside-click dispatcher (created on first use). */
export const overlayOutsideClickDispatcher = (): OverlayOutsideClickDispatcher => (outside ??= new OverlayOutsideClickDispatcher());
