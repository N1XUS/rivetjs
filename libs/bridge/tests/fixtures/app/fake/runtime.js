// The fake framework's shared "runtime" (stands in for react-dom): every island chunk of the app imports it, so a
// build keeps one copy (one shared chunk). FAKE_RUNTIME marks its code in the output.
export const VERSION = "FAKE_RUNTIME 1";
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
/** `<tag class>text</tag>` (escaped). */
export function h(tag, cls, text) {
  return `<${tag} class="${cls}">${esc(text)}</${tag}>`;
}
/** Calls of the client adapter in this page (`window.__fake`). */
export function log(...entry) {
  (globalThis.__fake ??= []).push(entry);
}
/** The fake framework's component wrapper (like React's `memo`): `export const X = component({ html, attach })`. */
export const component = (definition) => definition;
