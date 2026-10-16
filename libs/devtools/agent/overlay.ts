// The agent's page UI: one shadow-root host holding the dock button, the drawer with the panel iframe,
// the highlight box and update flashes. Only the button and drawer take pointer events; styles are a
// constructed stylesheet (no inline <style>, so strict CSP pages need nothing extra) and the DOM is
// built without HTML parsing (Trusted Types pages need no policy).

export interface Region {
  start: Node;
  end: Node;
}
export interface Overlay {
  readonly host: HTMLElement;
  open(): HTMLIFrameElement;
  close(): void;
  readonly opened: boolean;
  /** Remove the docked iframe (pop-out takes over). */
  detach(): void;
  highlight(rect: DOMRect | null, label?: string): void;
  /** Flash rects (amber, or `color`: a #rrggbb hex). */
  flash(rects: readonly DOMRect[], color?: string): void;
  /** Whether `node` belongs to the overlay (excluded from picking). */
  owns(node: Node | null): boolean;
}

const CSS = `
:host { all: initial; }
.toggle { position: fixed; right: 12px; bottom: 12px; z-index: 2147483647; width: 36px; height: 36px; border-radius: 18px; border: 1px solid #0f766e; background: #134e4a; color: #ecfeff; font: 600 13px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px rgb(0 0 0 / .25); }
.toggle[hidden], .drawer[hidden] { display: none; }
.drawer { position: fixed; left: 0; right: 0; bottom: 0; height: 45vh; z-index: 2147483646; display: flex; flex-direction: column; background: #0b1220; border-top: 2px solid #0f766e; box-shadow: 0 -4px 16px rgb(0 0 0 / .3); }
.drawer iframe { flex: 1; width: 100%; border: 0; background: #0b1220; }
.box { position: fixed; z-index: 2147483645; pointer-events: none; border: 2px solid #14b8a6; background: rgb(20 184 166 / .15); border-radius: 2px; }
.box[hidden] { display: none; }
.label { position: absolute; left: -2px; top: -22px; padding: 2px 6px; background: #134e4a; color: #ecfeff; font: 500 11px/16px ui-monospace, monospace; white-space: nowrap; border-radius: 2px; }
.flash { position: fixed; z-index: 2147483644; pointer-events: none; outline: 2px solid #f59e0b; background: rgb(245 158 11 / .12); animation: fade .8s ease-out forwards; }
@keyframes fade { to { opacity: 0; } }
`;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: Node): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}
function place(node: HTMLElement, rect: DOMRect): void {
  node.style.left = rect.left + "px";
  node.style.top = rect.top + "px";
  node.style.width = Math.max(rect.width, 2) + "px";
  node.style.height = Math.max(rect.height, 2) + "px";
}

/** Short element description: `<div id="x" class="a b">` (class list cut at 60 chars). */
export function describeElement(element: { localName: string; getAttribute(name: string): string | null }): string {
  const id = element.getAttribute("id"),
    cls = element.getAttribute("class");
  return "<" + element.localName + (id ? ` id="${id}"` : "") + (cls ? ` class="${cls.length > 60 ? cls.slice(0, 59) + "…" : cls}"` : "") + ">";
}
/** Viewport rect of an element, a node span (comment markers or first / last node), or a text node; null when not rendered. */
export function rectOf(target: object | null | undefined): DOMRect | null {
  if (!target) return null;
  let rect: DOMRect | null = null;
  if ("start" in target && "end" in target) {
    const { start, end } = target as Region;
    if (!start.isConnected || start.parentNode !== end.parentNode) return null;
    // Both ends inclusive: v1 spans are comment markers (no box), DOM v2 spans the output's first / last node.
    const range = document.createRange();
    range.setStartBefore(start);
    range.setEndAfter(end);
    rect = range.getBoundingClientRect();
  } else if (target instanceof Element) rect = target.getBoundingClientRect();
  else if (target instanceof Node && target.parentElement) rect = target.parentElement.getBoundingClientRect();
  return rect && (rect.width || rect.height) ? rect : null;
}

export function createOverlay(options: { url: () => string; onToggle(open: boolean): void; onLoad(frame: HTMLIFrameElement): void }): Overlay {
  const host = document.createElement("rivet-devtools");
  host.setAttribute("data-rivet-devtools", "");
  const shadow = host.attachShadow({ mode: "open" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  shadow.adoptedStyleSheets = [sheet];
  const toggle = element("button", "toggle", shadow);
  toggle.type = "button";
  toggle.textContent = "R";
  toggle.title = "Rivet DevTools (Alt+Shift+R)";
  toggle.setAttribute("aria-label", "Open Rivet DevTools");
  const drawer = element("div", "drawer", shadow);
  drawer.hidden = true;
  const box = element("div", "box", shadow);
  box.hidden = true;
  const label = element("span", "label", box);
  let frame: HTMLIFrameElement | null = null;
  // Outside the app's containers (mounts may clear theirs): the last child of <html>.
  const attach = () => document.documentElement.appendChild(host);
  if (document.documentElement) attach();
  else document.addEventListener("DOMContentLoaded", attach, { once: true });

  const overlay: Overlay = {
    host,
    get opened() {
      return !drawer.hidden;
    },
    open() {
      if (!frame) {
        const created = (frame = element("iframe", "", drawer));
        created.title = "Rivet DevTools";
        // Each load (the panel may reload itself) gets a fresh connection.
        created.addEventListener("load", () => options.onLoad(created));
        created.src = options.url();
      }
      drawer.hidden = false;
      toggle.hidden = true;
      options.onToggle(true);
      return frame;
    },
    close() {
      drawer.hidden = true;
      toggle.hidden = false;
      overlay.highlight(null);
      options.onToggle(false);
    },
    detach() {
      frame?.remove();
      frame = null;
      drawer.hidden = true;
      toggle.hidden = false;
    },
    highlight(rect, text) {
      box.hidden = !rect;
      if (!rect) return;
      place(box, rect);
      label.textContent = text ?? "";
      label.hidden = !text;
    },
    flash(rects, color) {
      for (const rect of rects) {
        const node = element("div", "flash", shadow);
        place(node, rect);
        if (color) {
          node.style.outlineColor = color;
          node.style.background = color + "26";
        }
        node.addEventListener("animationend", () => node.remove(), { once: true });
        // Background tabs may not run animations: remove regardless.
        setTimeout(() => node.remove(), 1500);
      }
    },
    owns: (node) => node !== null && (node === host || host.contains(node) || node.getRootNode() === shadow),
  };
  toggle.addEventListener("click", () => overlay.open());
  return overlay;
}
