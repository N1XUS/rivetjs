// AriaDescriber (shared, reference-counted `aria-describedby` message elements in one visually
// hidden container) and the aria-reference id-list helpers.
// Ported from Angular CDK a11y aria-describer / aria-reference (angular/components), MIT, © Google LLC.
//
// Rivet: a plain class; APP_ID becomes the optional `appId` constructor argument. Browser only.
import { hideVisually } from "./index.ts";

const ID_DELIMITER = " ";

/** Add `id` to the space-separated id list in `attr` (no duplicates). */
export function addAriaReferencedId(el: Element, attr: `aria-${string}`, id: string): void {
  const ids = getAriaReferenceIds(el, attr);
  id = id.trim();
  if (ids.some((existingId) => existingId.trim() === id)) return;
  ids.push(id);
  el.setAttribute(attr, ids.join(ID_DELIMITER));
}

/** Remove `id` from the id list in `attr`; removes the attribute when the list becomes empty. */
export function removeAriaReferencedId(el: Element, attr: `aria-${string}`, id: string): void {
  const ids = getAriaReferenceIds(el, attr);
  id = id.trim();
  const filteredIds = ids.filter((val) => val !== id);
  if (filteredIds.length) el.setAttribute(attr, filteredIds.join(ID_DELIMITER));
  else el.removeAttribute(attr);
}

/** The ids in an id-list attribute. */
export function getAriaReferenceIds(el: Element, attr: string): string[] {
  const attrValue = el.getAttribute(attr);
  return attrValue?.match(/\S+/g) ?? [];
}

export interface RegisteredMessage {
  /** The element holding the message text. */
  messageElement: Element;
  /** Number of elements described by it. */
  referenceCount: number;
}

/** Id prefix of message elements created by the describer. */
export const CDK_DESCRIBEDBY_ID_PREFIX = "cdk-describedby-message";
/** Attribute marking elements described by a describer (value: the describer id). */
export const CDK_DESCRIBEDBY_HOST_ATTRIBUTE = "cdk-describedby-host";

const g = { nextId: 0 };

/**
 * Adds `aria-describedby` descriptions to elements, sharing one message element per distinct
 * message (+ role) and removing it when no element references it any more.
 */
export class AriaDescriber {
  private _messageRegistry = new Map<string | Element, RegisteredMessage>();
  private _messagesContainer: HTMLElement | null = null;
  private readonly _id: string;
  private readonly _document: Document;

  constructor(appId = "rv", doc: Document = document) {
    this._document = doc;
    this._id = appId + "-" + g.nextId++;
  }

  /** Describe `hostElement` with a message string (+ role) or an existing element. */
  describe(hostElement: Element, message: string, role?: string): void;
  describe(hostElement: Element, message: HTMLElement): void;
  describe(hostElement: Element, message: string | HTMLElement, role?: string): void {
    if (!this._canBeDescribed(hostElement, message)) return;
    const key = getKey(message, role);
    if (typeof message !== "string") {
      setMessageId(message, this._id);
      this._messageRegistry.set(key, { messageElement: message, referenceCount: 0 });
    } else if (!this._messageRegistry.has(key)) this._createMessageElement(message, role);
    if (!this._isElementDescribedByMessage(hostElement, key)) this._addMessageReference(hostElement, key);
  }

  /** Remove a description; a created message element is deleted when unreferenced. */
  removeDescription(hostElement: Element, message: string, role?: string): void;
  removeDescription(hostElement: Element, message: HTMLElement): void;
  removeDescription(hostElement: Element, message: string | HTMLElement, role?: string): void {
    if (!message || !this._isElementNode(hostElement)) return;
    const key = getKey(message, role);
    if (this._isElementDescribedByMessage(hostElement, key)) this._removeMessageReference(hostElement, key);
    // Only messages created here are removed; consumer elements stay.
    if (typeof message === "string") {
      const registeredMessage = this._messageRegistry.get(key);
      if (registeredMessage && registeredMessage.referenceCount === 0) this._deleteMessageElement(key);
    }
    if (this._messagesContainer?.childNodes.length === 0) {
      this._messagesContainer.remove();
      this._messagesContainer = null;
    }
  }

  /** Remove all descriptions and the container (ngOnDestroy). */
  destroy(): void {
    const describedElements = this._document.querySelectorAll(`[${CDK_DESCRIBEDBY_HOST_ATTRIBUTE}="${this._id}"]`);
    for (let i = 0; i < describedElements.length; i++) {
      this._removeCdkDescribedByReferenceIds(describedElements[i]!);
      describedElements[i]!.removeAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE);
    }
    this._messagesContainer?.remove();
    this._messagesContainer = null;
    this._messageRegistry.clear();
  }

  private _createMessageElement(message: string, role?: string): void {
    const messageElement = this._document.createElement("div");
    setMessageId(messageElement, this._id);
    messageElement.textContent = message;
    if (role) messageElement.setAttribute("role", role);
    this._createMessagesContainer();
    this._messagesContainer!.appendChild(messageElement);
    this._messageRegistry.set(getKey(message, role), { messageElement, referenceCount: 0 });
  }

  private _deleteMessageElement(key: string | Element): void {
    this._messageRegistry.get(key)?.messageElement?.remove();
    this._messageRegistry.delete(key);
  }

  private _createMessagesContainer(): void {
    if (this._messagesContainer) return;
    const containerClassName = "cdk-describedby-message-container";
    // Drop server-rendered containers we hold no reference to.
    const serverContainers = this._document.querySelectorAll(`.${containerClassName}[platform="server"]`);
    for (let i = 0; i < serverContainers.length; i++) serverContainers[i]!.remove();
    const messagesContainer = this._document.createElement("div");
    // visibility: hidden keeps the text out of find-in-page; screen readers still read descriptions.
    messagesContainer.style.visibility = "hidden";
    messagesContainer.classList.add(containerClassName, "cdk-visually-hidden");
    hideVisually(messagesContainer);
    this._document.body.appendChild(messagesContainer);
    this._messagesContainer = messagesContainer;
  }

  private _removeCdkDescribedByReferenceIds(element: Element): void {
    const originalReferenceIds = getAriaReferenceIds(element, "aria-describedby").filter((id) => id.indexOf(CDK_DESCRIBEDBY_ID_PREFIX) != 0);
    element.setAttribute("aria-describedby", originalReferenceIds.join(" "));
  }

  private _addMessageReference(element: Element, key: string | Element): void {
    const registeredMessage = this._messageRegistry.get(key)!;
    addAriaReferencedId(element, "aria-describedby", registeredMessage.messageElement.id);
    element.setAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE, this._id);
    registeredMessage.referenceCount++;
  }

  private _removeMessageReference(element: Element, key: string | Element): void {
    const registeredMessage = this._messageRegistry.get(key)!;
    registeredMessage.referenceCount--;
    removeAriaReferencedId(element, "aria-describedby", registeredMessage.messageElement.id);
    element.removeAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE);
  }

  private _isElementDescribedByMessage(element: Element, key: string | Element): boolean {
    const referenceIds = getAriaReferenceIds(element, "aria-describedby");
    const registeredMessage = this._messageRegistry.get(key);
    const messageId = registeredMessage && registeredMessage.messageElement.id;
    return !!messageId && referenceIds.indexOf(messageId) != -1;
  }

  private _canBeDescribed(element: Element, message: string | HTMLElement | void): boolean {
    if (!this._isElementNode(element)) return false;
    // A consumer-provided element is assumed to be a valid description.
    if (message && typeof message === "object") return true;
    const trimmedMessage = message == null ? "" : `${message}`.trim();
    const ariaLabel = element.getAttribute("aria-label");
    // A description equal to the aria-label would be read twice.
    return trimmedMessage ? !ariaLabel || ariaLabel.trim() !== trimmedMessage : false;
  }

  private _isElementNode(element: Node): element is Element {
    return element.nodeType === this._document.ELEMENT_NODE;
  }
}

function getKey(message: string | Element, role?: string): string | Element {
  return typeof message === "string" ? `${role || ""}/${message}` : message;
}

function setMessageId(element: HTMLElement, serviceId: string): void {
  if (!element.id) element.id = `${CDK_DESCRIBEDBY_ID_PREFIX}-${serviceId}-${g.nextId++}`;
}

let shared: AriaDescriber | null = null;

/** The shared AriaDescriber. */
export function getAriaDescriber(): AriaDescriber {
  return (shared ??= new AriaDescriber());
}
