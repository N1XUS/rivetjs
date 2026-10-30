import { escapeAttribute } from "@rivetjs/runtime/escape";

/** Native-head-only SSR bootstrap. Serialized from this self-contained function; no closure values enter the script. */
export function installNativeHeadLifecycle(d: Document): void {
  type Entry = { root: Element; start: Comment; end: Comment; title?: HTMLTitleElement };
  type State = { discard(framework: string, id: string): void };
  const doc = d as Document & { $rnh?: State };
  if (doc.$rnh) return;
  const entries = new Map<string, Entry>();
  let observer: MutationObserver | undefined;
  function drop(key: string, preserveTitle: boolean): void {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    const currentTitle = entry.title && (entry.title.isConnected ? d.title : (entry.title.textContent ?? ""));
    if (entry.start.parentNode === d.head && entry.end.parentNode === d.head) {
      let node: Node | null = entry.start;
      while (node) {
        const next: Node | null = node.nextSibling;
        node.parentNode!.removeChild(node);
        if (node === entry.end) break;
        node = next;
      }
    }
    // Kit changes document.title in place, potentially writing the old island's title node before navigation removes
    // that island. Preserve the new value as an ordinary title when removing the obsolete ownership range.
    if (preserveTitle && currentTitle && !d.head.querySelector("title")) {
      const title = d.createElement("title");
      title.textContent = currentTitle;
      d.head.prepend(title);
    }
    if (!entries.size) {
      observer?.disconnect();
      delete doc.$rnh;
    }
  }
  doc.$rnh = { discard: (framework, id) => drop(framework + ":" + id, false) };
  const init = () => {
    let open: { start: Comment; framework: string; id: string } | undefined;
    for (const node of [...d.head.childNodes]) {
      if (node.nodeType !== 8) continue;
      const comment = node as Comment;
      const match = /^rivet-head:(vue|svelte):([A-Za-z0-9_-]+)$/.exec(comment.data);
      if (match) open = { start: comment, framework: match[1]!, id: match[2]! };
      else if (open && comment.data === `/rivet-head:${open.framework}:${open.id}`) {
        const root = d.querySelector(`rivet-island[data-ri="${open.id}"]`);
        if (root) {
          let title: HTMLTitleElement | undefined;
          for (let child = open.start.nextSibling; child && child !== comment; child = child.nextSibling)
            if (child.nodeType === 1 && (child as Element).localName === "title") title = child as HTMLTitleElement;
          entries.set(open.framework + ":" + open.id, { root, start: open.start, end: comment, title });
        }
        open = undefined;
      }
    }
    if (!entries.size) {
      delete doc.$rnh;
      return;
    }
    observer = new MutationObserver(() => {
      for (const [key, entry] of entries) if (!entry.root.isConnected) drop(key, true);
    });
    observer.observe(d.body ?? d.documentElement, { childList: true, subtree: true });
  };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}

/** One request-nonced bootstrap, appended by the server head renderer only when native ranges exist. */
export function nativeHeadLifecycle(nonce?: string): string {
  const attribute = nonce ? ` nonce="${escapeAttribute(nonce)}"` : "";
  return `<script data-rivet-native-head${attribute}>(${installNativeHeadLifecycle.toString()})(document)</script>`;
}
