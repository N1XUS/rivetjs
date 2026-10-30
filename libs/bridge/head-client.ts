// Imported only by native-head adapters. Resource elements are never detached, cloned, or reordered.
type Framework = "vue" | "svelte";
interface HeadRange {
  start: Comment;
  end: Comment;
  framework: Framework;
  id: string;
}
interface CursorHead extends HTMLHeadElement {
  _lpa?: Node | null;
}

function ranges(head: HTMLHeadElement): HeadRange[] {
  const result: HeadRange[] = [];
  let open: { start: Comment; framework: Framework; id: string } | undefined;
  for (const node of head.childNodes) {
    if (node.nodeType !== 8) continue;
    const comment = node as Comment;
    const start = /^rivet-head:(vue|svelte):([A-Za-z0-9_-]+)$/.exec(comment.data);
    if (start) {
      if (open) throw new Error("Native head ranges overlap; a framework emitted invalid head markup");
      open = { start: comment, framework: start[1] as Framework, id: start[2]! };
    } else if (open && comment.data === `/rivet-head:${open.framework}:${open.id}`) {
      result.push({ ...open, end: comment });
      open = undefined;
    }
  }
  if (open) throw new Error("Native head range has no closing marker; a framework emitted invalid head markup");
  return result;
}

let pending: Promise<void> | undefined;
/**
 * Hydrate against only this island's native markers, even when several instances share a Svelte head hash or Vue's
 * Teleport cursor. A thenable callback holds the scope until all async initialization has finished. Concurrent calls
 * serialize; synchronous uncontended calls retain the adapter's synchronous return value. Every scope restores on error.
 */
export function withNativeHead<T>(framework: Framework, id: string, run: (native: boolean) => T): T | Promise<Awaited<T>> {
  if (pending) return pending.then(() => withNativeHead(framework, id, run)) as Promise<Awaited<T>>;
  const head = document.head as CursorHead;
  const all = ranges(head);
  const own = all.find((range) => range.framework === framework && range.id === id);
  if (!own) return run(false); // no early native head: the framework uses its documented head-mount behavior

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  pending = gate;
  const hidden: [Comment, string][] = [];
  const cursor = Object.getOwnPropertyDescriptor(head, "_lpa");
  let firstTeleport: Comment | undefined;
  const allowed = new Set<Node>();
  for (const range of all) {
    for (let node = range.start.nextSibling; node && node !== range.end; node = node.nextSibling) {
      if (range === own) {
        allowed.add(node);
        if (node.nodeType === 8 && (node as Comment).data === "teleport start anchor") firstTeleport ??= node as Comment;
      } else if (range.framework === framework && node.nodeType === 8) {
        const comment = node as Comment;
        hidden.push([comment, comment.data]);
        comment.data = "rivet-head-hidden";
      }
    }
  }
  allowed.add(own.end);
  const restore = () => {
    for (const [comment, data] of hidden) comment.data = data;
    if (framework === "vue") {
      if (cursor) Object.defineProperty(head, "_lpa", cursor);
      else delete head._lpa;
    }
    if (pending === gate) pending = undefined;
    release();
  };
  const check = <V>(value: V): V => {
    // Vue 3.5's public Teleport has no hydration-target cursor API. Guard this pinned private contract loudly;
    // a changed/ignored cursor must not silently hydrate another island's head or create duplicate metadata.
    if (framework === "vue" && firstTeleport && (head._lpa === firstTeleport || !head._lpa || !allowed.has(head._lpa)))
      throw new Error("Vue native head hydration cursor (_lpa) did not advance within its island range; this Vue version is unsupported.");
    return value;
  };
  try {
    if (framework === "vue" && firstTeleport) head._lpa = firstTeleport;
    const value = run(true);
    if (value && typeof (value as unknown as PromiseLike<unknown>).then === "function")
      return Promise.resolve(value).then(check).finally(restore) as Promise<Awaited<T>>;
    const result = check(value);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

/** Remove this island's unclaimed SSR head before a hydration-error mount fallback. Successful hydration never calls it. */
export function discardNativeHead(framework: Framework, id: string): void {
  (document as Document & { $rnh?: { discard(framework: string, id: string): void } }).$rnh?.discard(framework, id);
  const own = ranges(document.head).find((range) => range.framework === framework && range.id === id);
  if (!own) return;
  let node: Node | null = own.start;
  while (node) {
    const next: Node | null = node.nextSibling;
    node.parentNode?.removeChild(node);
    if (node === own.end) break;
    node = next;
  }
}
