// LiveAnnouncer (one shared aria-live element, 100 ms delayed write so repeated messages are read,
// optional clear duration, `aria-owns` exposure to open modals) and the cdkAriaLive directive.
// Ported from Angular CDK a11y live-announcer (angular/components), MIT, © Google LLC.
//
// Rivet: a plain class; options replace the LIVE_ANNOUNCER_ELEMENT_TOKEN / _DEFAULT_OPTIONS tokens.
// Deviation: messages are text only (Angular also accepts sanitized `SafeHtml`). The modal lookup
// covers CDK overlay containers, Rivet modals (`[data-rv-overlay][aria-modal]`) and top-layer elements.
// Browser only. For react-aria-style announcements use `@rivetjs/cdk/live-announcer`.
import { hideVisually } from "./index.ts";

export type AriaLivePoliteness = "off" | "polite" | "assertive";

export interface LiveAnnouncerDefaultOptions {
  /** Default politeness. */
  politeness?: AriaLivePoliteness;
  /** Default time (ms) after which the message is cleared. */
  duration?: number;
}

export interface LiveAnnouncerOptions extends LiveAnnouncerDefaultOptions {
  /** Use this element instead of creating one (LIVE_ANNOUNCER_ELEMENT_TOKEN). */
  liveElement?: HTMLElement | null;
  document?: Document;
}

const g = { uniqueIds: 0 };

/** Announces messages to screen readers through an aria-live region. */
export class LiveAnnouncer {
  private _liveElement: HTMLElement;
  private _document: Document;
  private _defaultOptions: LiveAnnouncerDefaultOptions | null;
  private _previousTimeout: ReturnType<typeof setTimeout> | undefined;
  private _currentPromise: Promise<void> | undefined;
  private _currentResolve: (() => void) | undefined;

  constructor(options: LiveAnnouncerOptions = {}) {
    this._document = options.document ?? document;
    this._defaultOptions = options.politeness || options.duration != null ? { politeness: options.politeness, duration: options.duration } : null;
    this._liveElement = options.liveElement || this._createLiveElement();
  }

  /** Announce `message`; resolves once it is written to the live region. */
  announce(message: string): Promise<void>;
  announce(message: string, politeness?: AriaLivePoliteness): Promise<void>;
  announce(message: string, duration?: number): Promise<void>;
  announce(message: string, politeness?: AriaLivePoliteness, duration?: number): Promise<void>;
  announce(message: string, ...args: unknown[]): Promise<void> {
    const defaultOptions = this._defaultOptions;
    let politeness: AriaLivePoliteness | undefined;
    let duration: number | undefined;
    if (args.length === 1 && typeof args[0] === "number") duration = args[0];
    else [politeness, duration] = args as [AriaLivePoliteness | undefined, number | undefined];
    this.clear();
    clearTimeout(this._previousTimeout);
    if (!politeness) politeness = defaultOptions && defaultOptions.politeness ? defaultOptions.politeness : "polite";
    if (duration == null && defaultOptions) duration = defaultOptions.duration;
    this._liveElement.setAttribute("aria-live", politeness);
    if (this._liveElement.id) this._exposeAnnouncerToModals(this._liveElement.id);
    // The 100 ms delay: some browser + screen reader pairs skip immediate or repeated identical writes.
    if (!this._currentPromise) this._currentPromise = new Promise((resolve) => (this._currentResolve = resolve));
    clearTimeout(this._previousTimeout);
    this._previousTimeout = setTimeout(() => {
      this._liveElement.textContent = message;
      if (typeof duration === "number") this._previousTimeout = setTimeout(() => this.clear(), duration);
      this._currentResolve?.();
      this._currentPromise = this._currentResolve = undefined;
    }, 100);
    return this._currentPromise;
  }

  /** Clear the live region (a cleared region is not re-read on focus). */
  clear(): void {
    if (this._liveElement) this._liveElement.textContent = "";
  }

  /** Remove the live element (ngOnDestroy). */
  destroy(): void {
    clearTimeout(this._previousTimeout);
    this._liveElement?.remove();
    this._liveElement = null!;
    this._currentResolve?.();
    this._currentPromise = this._currentResolve = undefined;
  }

  private _createLiveElement(): HTMLElement {
    const elementClass = "cdk-live-announcer-element";
    const previousElements = this._document.getElementsByClassName(elementClass);
    const liveEl = this._document.createElement("div");
    // Remove stale containers (e.g. server-rendered).
    for (let i = previousElements.length - 1; i >= 0; i--) previousElements[i]!.remove();
    liveEl.classList.add(elementClass, "cdk-visually-hidden");
    hideVisually(liveEl);
    liveEl.setAttribute("aria-atomic", "true");
    liveEl.setAttribute("aria-live", "polite");
    liveEl.id = `cdk-live-announcer-${g.uniqueIds++}`;
    this._document.body.appendChild(liveEl);
    return liveEl;
  }

  /** Modal dialogs hide the rest of the page from screen readers: make them own the live element. */
  private _exposeAnnouncerToModals(id: string): void {
    const modals = this._document.querySelectorAll(
      'body > .cdk-overlay-container [aria-modal="true"], [data-rv-top-layer] [aria-modal="true"], [data-rv-top-layer][aria-modal="true"], [data-rv-overlay][aria-modal="true"]',
    );
    for (let i = 0; i < modals.length; i++) {
      const modal = modals[i]!;
      const ariaOwns = modal.getAttribute("aria-owns");
      if (!ariaOwns) modal.setAttribute("aria-owns", id);
      else if (ariaOwns.indexOf(id) === -1) modal.setAttribute("aria-owns", ariaOwns + " " + id);
    }
  }
}

let shared: LiveAnnouncer | null = null;

/** The shared LiveAnnouncer (created on first call). */
export function getLiveAnnouncer(): LiveAnnouncer {
  return (shared ??= new LiveAnnouncer());
}

/**
 * The cdkAriaLive directive: announce the element's text content whenever it changes (not on
 * attribute changes). Call `destroy()` on unmount.
 */
export class CdkAriaLive {
  private _politeness: AriaLivePoliteness = "polite";
  private _previousAnnouncedText?: string | null;
  private _observer: MutationObserver | undefined;
  /** Clear duration passed to the announcer. */
  duration: number | undefined;

  private readonly _element: HTMLElement;
  private readonly _liveAnnouncer: LiveAnnouncer;

  constructor(element: HTMLElement, politeness: AriaLivePoliteness = "polite", duration?: number, liveAnnouncer: LiveAnnouncer = getLiveAnnouncer()) {
    this._element = element;
    this._liveAnnouncer = liveAnnouncer;
    this.duration = duration;
    this.politeness = politeness;
  }

  get politeness(): AriaLivePoliteness {
    return this._politeness;
  }
  set politeness(value: AriaLivePoliteness) {
    this._politeness = value === "off" || value === "assertive" ? value : "polite";
    if (this._politeness === "off") {
      this._observer?.disconnect();
      this._observer = undefined;
    } else if (!this._observer) {
      this._observer = new MutationObserver(() => {
        const elementText = this._element.textContent;
        if (elementText !== this._previousAnnouncedText) {
          void this._liveAnnouncer.announce(elementText ?? "", this._politeness, this.duration);
          this._previousAnnouncedText = elementText;
        }
      });
      // ContentObserver: characterData + childList, subtree.
      this._observer.observe(this._element, { characterData: true, childList: true, subtree: true });
    }
  }

  destroy(): void {
    this._observer?.disconnect();
    this._observer = undefined;
  }
}
