// libs/runtime/server.ts — rawRow: how a list row reaches the response.
// Pass 1 computes the exact byte budget (or bails to the generic path). Pass 2 does ONE claim,
// interleaves pre-encoded static fragments with putInt32/putText directly into the slab, ONE commit.
// No per-row string, no per-row array, no per-row object.
const rawRow = (fragments: readonly Uint8Array[], attributes: readonly PlanSlot[], tape: readonly unknown[], base: number, fixed: number): unknown => {
  const width = attributes.length;
  let need = fixed;
  for (let k = 0; k < width; k++) {
    const attribute = attributes[k]!;
    if (typeof attribute === "number") continue;
    const child = tape[base + k],
      kind = typeof child;
    if (kind === "number") {
      if (!safeInteger(child as number)) return GENERIC;
      if (attribute !== null) {
        if (attribute.raw === null) return GENERIC;
        need += attribute.raw.prefix.length + 1;
      }
      need += INTEGER_BYTES;
    } else if (attribute !== null) {
      if (child != null) return RAW_WIDE;
    } else if (kind === "string") {
      if ((child as string).length > RAW_TEXT) return GENERIC;
      need += (child as string).length * TEXT_UNIT_BYTES;
    } else if (child != null && kind !== "boolean") return kind === "object" ? RAW_WIDE : GENERIC;
  }
  if (need > RAW_MAX) return GENERIC;
  const waiting = writer.claim!(need);
  const target = writer.bytes!;
  let offset = writer.offset!;
  for (let k = 0; k < width; k++) {
    const fragment = fragments[k]!;
    target.set(fragment, offset);
    offset += fragment.length;
    const attribute = attributes[k]!;
    if (typeof attribute === "number") continue;
    const child = tape[base + k];
    if (typeof child === "number") {
      if (attribute !== null) {
        const prefix = attribute.raw!.prefix;
        target.set(prefix, offset);
        offset += prefix.length;
      }
      offset = (child | 0) === child ? putInt32(target, offset, child) : putSafeInteger(target, offset, child);
      if (attribute !== null) target[offset++] = 34;
    } else if (typeof child === "string") offset = putText(target, offset, child);
  }
  const last = fragments[width]!;
  target.set(last, offset);
  const committed = writer.commit!(offset + last.length);
  return waiting ?? committed;
};
