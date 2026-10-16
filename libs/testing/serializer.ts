// Vitest / Jest snapshot serializer for Rivet-rendered DOM: comment nodes (v1 `<!--rivet:start-->` /
// `<!--rivet:end-->` ranges, v2 `<!---->` anchors, resume markers) and empty Text anchors are dropped
// and adjacent text merged, then the default DOM printer prints the copy — so a `<Show>` + `<For>`
// snapshot shows the markup a user sees, not the runtime's bookkeeping. `rivetTest()` registers it
// (`test.snapshotSerializers`); elsewhere `expect.addSnapshotSerializer(rivetSerializer)`.
// The live node is never touched (a deep clone is printed).

interface Printer {
  (value: unknown, config: unknown, indentation: string, depth: number, refs: unknown[]): string;
}

/** Copies already cleaned (and every node inside them), so the default printer takes over for them. */
const printed = new WeakSet<object>();

const isNode = (value: unknown): value is Node =>
  value != null &&
  typeof value === "object" &&
  typeof (value as Node).nodeType === "number" &&
  typeof (value as Node).cloneNode === "function" &&
  typeof (value as Node).nodeName === "string";

const strip = (root: Node): void => {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, 128 /* NodeFilter.SHOW_COMMENT */);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const comment of comments) comment.parentNode?.removeChild(comment);
  root.normalize(); // merges adjacent Text nodes, drops empty ones
};

const mark = (root: Node): void => {
  printed.add(root);
  for (let child = root.firstChild; child; child = child.nextSibling) mark(child);
};

export const rivetSerializer = {
  test(value: unknown): boolean {
    return isNode(value) && !printed.has(value) && (value.nodeType === 1 || value.nodeType === 11);
  },
  serialize(value: Node, config: unknown, indentation: string, depth: number, refs: unknown[], printer: Printer): string {
    const copy = value.cloneNode(true);
    strip(copy);
    mark(copy);
    return printer(copy, config, indentation, depth, refs);
  },
};

export default rivetSerializer;
