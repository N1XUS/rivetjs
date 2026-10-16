// DOM content as a stable string, independent of the compile target's bookkeeping: comment markers
// (v1 `<!--rivet:…-->` ranges, v2 `<!>` anchors) and empty Text anchors are dropped, adjacent text is
// merged, attributes are sorted, and live form state (`value` / `checked` / `selected`) is included.
// Tests assert what the user sees, not marker shape (DOM v2-only spec, Q9).

export interface NormalizeOptions {
  /** Include live form-control properties as `:value` / `:checked` / `:selected` pseudo-attributes (default true). */
  properties?: boolean;
  /** Mark the focused element with `:focus` (default true). */
  focus?: boolean;
}

const escapeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text: string): string => escapeText(text).replace(/"/g, "&quot;");

/** Normalized markup of `node`'s children (or of `node` itself when `self` is true). */
export function normalizedHTML(node: Node, options: NormalizeOptions = {}, self = false): string {
  const properties = options.properties !== false,
    focused = options.focus !== false ? (node.ownerDocument ?? (node as Document)).activeElement : null;
  let out = "",
    text = "";
  const flush = () => {
    if (text) out += escapeText(text);
    text = "";
  };
  const walk = (n: Node): void => {
    if (n.nodeType === 3) {
      text += (n as Text).data;
      return;
    }
    if (n.nodeType === 11 || n.nodeType === 9) {
      for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
      return;
    }
    if (n.nodeType !== 1) return;
    flush();
    const el = n as Element,
      name =
        el.namespaceURI === "http://www.w3.org/1999/xhtml"
          ? el.localName
          : el.namespaceURI === "http://www.w3.org/2000/svg"
            ? "svg:" + el.localName
            : el.localName;
    const attrs = Array.from(el.attributes, (a) => [a.name, a.value] as [string, string]);
    if (properties) {
      const control = el as unknown as { value?: unknown; checked?: unknown; selected?: unknown };
      if ((el.localName === "input" || el.localName === "textarea" || el.localName === "select") && typeof control.value === "string")
        attrs.push([":value", control.value]);
      if (el.localName === "input" && control.checked === true) attrs.push([":checked", ""]);
      if (el.localName === "option" && control.selected === true) attrs.push([":selected", ""]);
    }
    if (focused === el) attrs.push([":focus", ""]);
    attrs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    out += "<" + name;
    for (const [k, v] of attrs) out += v === "" ? " " + k : ` ${k}="${escapeAttr(v)}"`;
    out += ">";
    const content = el.localName === "template" && (el as HTMLTemplateElement).content ? (el as HTMLTemplateElement).content : el;
    for (let c = content.firstChild; c; c = c.nextSibling) walk(c);
    flush();
    out += "</" + name + ">";
  };
  if (self) walk(node);
  else for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  flush();
  return out;
}
