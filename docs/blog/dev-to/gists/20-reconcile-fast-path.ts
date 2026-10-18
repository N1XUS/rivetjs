// libs/runtime/dom-v2.ts — reconcile(): udomdiff (as in dom-expressions), plus one fast path:
// nothing kept AND the list owns the whole parent → one native wipe, then append.
// `parent.textContent = ""` is the fastest way to remove N children in every engine.
function reconcile(parent: Parent, a: Node[], b: Node[], marker: Node | null): void {
  const bLength = b.length;
  let aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0,
    map: Map<Node, number> | null = null, copied = false;
  let last = aEnd - 1;
  while (last >= 0 && a[last].parentNode !== parent) last--;
  const after = last >= 0 ? a[last].nextSibling : marker;
  // Nothing kept and the list owns the parent: one native wipe, then append (replace all).
  if (marker === null && bLength > 0 && a[0] !== b[0] && parent.firstChild === a[0] && parent.lastChild === a[aEnd - 1]) {
    map = new Map();
    for (let i = 0; i < bLength; i++) map.set(b[i], i);
    let kept = false;
    for (let i = 0; i < aEnd; i++)
      if (map.has(a[i])) { kept = true; break; }
    if (!kept) {
      parent.textContent = "";
      for (let i = 0; i < bLength; i++) parent.insertBefore(b[i], null);
      return;
    }
  }
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) { aStart++; bStart++; continue; }
    while (aEnd > aStart && bEnd > bStart && a[aEnd - 1] === b[bEnd - 1]) { aEnd--; bEnd--; }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? (bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart]) : after;
      while (bStart < bEnd) parent.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        const node = a[aStart++];
        if ((map === null || !map.has(node)) && node.parentNode === parent) parent.removeChild(node);
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      // swapped ends
      const node = a[--aEnd].nextSibling;
      parent.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parent.insertBefore(b[--bEnd], node);
      if (!copied) { a = a.slice(); copied = true; }
      a[aEnd] = b[bEnd];
    } else {
      // keyed middle: see udomdiff
      /* … */
    }
  }
}
