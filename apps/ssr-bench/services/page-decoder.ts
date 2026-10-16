// Static single-pass decoder for rivet.bench.Page (proto/content.proto), the counterpart of
// generated C# protobuf code. Produces the same plain shape as proto-loader with
// { defaults: true, arrays: true } without intermediate message instances.
/** Decoded rivet.bench.Row. `values` holds `text_values` (strings) for the escaping variant. */
export interface Row {
  id: number;
  values: (number | string)[];
}
/** Decoded rivet.bench.Page. */
export interface Page {
  token: string;
  title: string;
  markdown: string;
  rows: Row[];
}

let buf: Buffer, pos: number;

function varint(): number {
  let byte = buf[pos++];
  let value = byte & 0x7f;
  if (byte < 0x80) return value;
  byte = buf[pos++]; value |= (byte & 0x7f) << 7; if (byte < 0x80) return value;
  byte = buf[pos++]; value |= (byte & 0x7f) << 14; if (byte < 0x80) return value;
  byte = buf[pos++]; value |= (byte & 0x7f) << 21; if (byte < 0x80) return value;
  byte = buf[pos++]; value |= (byte & 0x0f) << 28; if (byte < 0x80) return value;
  // Negative int32 values are sign-extended to ten bytes; the high bytes carry no int32 bits.
  for (let i = 0; i < 5; i++) if (buf[pos++] < 0x80) return value;
  throw new RangeError("Invalid varint");
}

function bounded(stop: number): void {
  if (pos > stop) throw new RangeError("Truncated protobuf message");
}

function skip(wire: number, stop: number): void {
  if (wire === 0) varint();
  else if (wire === 1) pos += 8;
  else if (wire === 2) {
    // Not `pos += varint()`: that reads pos before varint() advances it.
    const length = varint();
    pos += length;
  }
  else if (wire === 5) pos += 4;
  else throw new RangeError(`Unsupported wire type ${wire}`);
  bounded(stop);
}

function string(stop: number): string {
  const length = varint(), start = pos;
  pos += length;
  bounded(stop);
  return buf.toString("utf8", start, pos);
}

function row(stop: number): Row {
  let id = 0;
  const values: (number | string)[] = [];
  while (pos < stop) {
    const tag = varint();
    if (tag === 0x08) id = varint();
    else if (tag === 0x12) {
      const end = varint() + pos;
      bounded(stop);
      while (pos < end) values.push(varint());
      bounded(end);
    } else if (tag === 0x10) values.push(varint());
    else if (tag === 0x1a) values.push(string(stop));
    else skip(tag & 7, stop);
    bounded(stop);
  }
  return { id, values };
}

/** Decode one serialized Page buffer; throws RangeError on malformed or truncated input. */
export function decodePage(buffer: Buffer): Page {
  buf = buffer;
  pos = 0;
  const stop = buffer.length;
  const page: Page = { token: "", title: "", markdown: "", rows: [] };
  try {
    while (pos < stop) {
      const tag = varint();
      if (tag === 0x22) {
        const end = varint() + pos;
        bounded(stop);
        page.rows.push(row(end));
      } else if (tag === 0x0a) page.token = string(stop);
      else if (tag === 0x12) page.title = string(stop);
      else if (tag === 0x1a) page.markdown = string(stop);
      else skip(tag & 7, stop);
      bounded(stop);
    }
    return page;
  } finally {
    // Release the caller's buffer between calls.
    buf = undefined as unknown as Buffer;
  }
}
