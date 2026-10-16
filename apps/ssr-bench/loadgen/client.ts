// Minimal keep-alive HTTP/1.1 GET client on raw sockets: one request in flight per
// connection, Content-Length / chunked / close-delimited bodies. The parser is
// allocation-free per chunk: socket buffers are retained by reference and body bytes
// are recorded as numeric (buffer, start, end) segments, so the caller can decide after
// completion whether to materialize the body (responseBody) and strictly validate it.
import { connect, type Socket } from "node:net";

export const now = (): bigint => process.hrtime.bigint();

export type Response = {
  status: number;
  bytes: number;
  /** First response byte, hrtime ns. 0n when nothing arrived. */
  firstByte: bigint;
  end: bigint;
  /** Socket buffers that carry body bytes (by reference). */
  buffers: Buffer[];
  /** Flat triples: index into buffers, start, end. */
  segments: number[];
  error: string | null;
};

/** Concatenate the body bytes of a completed response. */
export function responseBody(response: Response): Buffer {
  const { buffers, segments } = response;
  if (segments.length === 3) return buffers[segments[0]!]!.subarray(segments[1]!, segments[2]!);
  const body = Buffer.allocUnsafe(response.bytes);
  let at = 0;
  for (let i = 0; i < segments.length; i += 3) at += buffers[segments[i]!]!.copy(body, at, segments[i + 1]!, segments[i + 2]!);
  return body;
}

/** The last `size` body bytes as latin1 text, without materializing the body. */
export function responseTail(response: Response, size = 64): string {
  const { buffers, segments } = response;
  let text = "";
  for (let i = segments.length - 3; i >= 0 && text.length < size; i -= 3) {
    const start = Math.max(segments[i + 1]!, segments[i + 2]! - (size - text.length));
    text = buffers[segments[i]!]!.toString("latin1", start, segments[i + 2]!) + text;
  }
  return text;
}

// Parser states (plain constants: erasableSyntaxOnly forbids enums).
const State = { Idle: 0, Head: 1, Length: 2, Close: 3, ChunkSize: 4, ChunkData: 5, ChunkCrlf: 6, Trailer: 7 } as const;

const CRLFCRLF = Buffer.from("\r\n\r\n");
// Hex digit value per byte, -1 for non-digits.
const HEX = new Int8Array(256).fill(-1);
for (let i = 0; i < 10; i++) HEX[48 + i] = i;
for (let i = 0; i < 6; i++) HEX[65 + i] = HEX[97 + i] = 10 + i;

export class Connection {
  readonly host: string;
  readonly port: number;
  readonly request: Buffer;
  /** Sockets opened after the first one (server close, error, timeout, protocol resync). */
  reconnects = -1;
  sentAt = 0n;
  private socket: Socket | null = null;
  private state: number = State.Idle;
  private head: Buffer | null = null;
  private remaining = 0;
  // Chunk-size / trailer line state, kept numeric across socket reads.
  private chunkSize = 0;
  private sawDigit = false;
  private inExtension = false;
  private lineLength = 0;
  private lastBuffer: Buffer | null = null;
  private closeAfter = false;
  private response: Response | null = null;
  private done: ((response: Response) => void) | null = null;

  constructor(host: string, port: number, path: string) {
    this.host = host;
    this.port = port;
    this.request = Buffer.from(`GET ${path} HTTP/1.1\r\nHost: ${host}:${port}\r\nConnection: keep-alive\r\nAccept: text/html\r\n\r\n`, "latin1");
  }

  get busy(): boolean {
    return this.done !== null;
  }

  /** Establish the TCP connection ahead of the measured window. Errors are left for the first request. */
  open(): Promise<void> {
    return new Promise((resolve) => {
      const socket = this.attach();
      socket.once("connect", () => resolve());
      socket.once("error", () => resolve());
    });
  }

  send(done: (response: Response) => void): void {
    const socket = this.socket && !this.socket.destroyed ? this.socket : this.attach();
    this.done = done;
    this.state = State.Head;
    this.head = null;
    this.closeAfter = false;
    this.lastBuffer = null;
    this.response = { status: 0, bytes: 0, firstByte: 0n, end: 0n, buffers: [], segments: [], error: null };
    this.sentAt = now();
    socket.write(this.request);
  }

  /** Abort the in-flight request (timeout / drain cap) and drop the socket. */
  abort(error: string): void {
    this.fail(error);
    this.drop();
  }

  close(): void {
    this.drop();
  }

  private attach(): Socket {
    this.reconnects++;
    const socket = connect({ host: this.host, port: this.port, noDelay: true });
    this.socket = socket;
    socket.on("data", (buffer: Buffer) => {
      if (this.socket === socket) this.feed(buffer);
    });
    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (this.socket === socket) this.fail(error.code || error.name);
    });
    socket.on("close", () => {
      if (this.socket !== socket) return;
      if (this.state === State.Close) this.finish();
      else this.fail("ConnectionClosed");
      this.socket = null;
    });
    return socket;
  }

  private drop(): void {
    const socket = this.socket;
    this.socket = null;
    socket?.destroy();
  }

  private fail(error: string): void {
    const response = this.response;
    const done = this.done;
    if (!response || !done) return;
    response.error = error;
    response.end = now();
    this.response = null;
    this.done = null;
    this.state = State.Idle;
    // Deferred so a callback that sends the next request never races the caller's
    // own socket teardown (abort/drop) or the rest of the current data chunk.
    queueMicrotask(() => done(response));
  }

  private finish(): void {
    const response = this.response!;
    const done = this.done!;
    response.end = now();
    this.response = null;
    this.done = null;
    this.state = State.Idle;
    if (this.closeAfter) this.drop();
    queueMicrotask(() => done(response));
  }

  private take(buffer: Buffer, start: number, end: number): void {
    if (end <= start) return;
    const response = this.response!;
    if (buffer !== this.lastBuffer) {
      response.buffers.push(buffer);
      this.lastBuffer = buffer;
    }
    response.bytes += end - start;
    response.segments.push(response.buffers.length - 1, start, end);
  }

  private startChunkSize(): void {
    this.state = State.ChunkSize;
    this.chunkSize = 0;
    this.sawDigit = false;
    this.inExtension = false;
  }

  /** Parse a chunk-size line from bytes; returns the new offset. */
  private chunkSizeLine(buffer: Buffer, offset: number): number {
    for (; offset < buffer.length; offset++) {
      const byte = buffer[offset]!;
      if (byte === 10) {
        if (!this.sawDigit) {
          this.protocolError("BadChunk");
          return buffer.length;
        }
        if (this.chunkSize === 0) {
          this.state = State.Trailer;
          this.lineLength = 0;
        } else {
          this.remaining = this.chunkSize;
          this.state = State.ChunkData;
        }
        return offset + 1;
      }
      if (this.inExtension || byte === 13) continue;
      const digit = HEX[byte]!;
      if (digit >= 0) {
        this.chunkSize = this.chunkSize * 16 + digit;
        this.sawDigit = true;
        if (this.chunkSize > 2 ** 40) {
          this.protocolError("BadChunk");
          return buffer.length;
        }
      } else if (byte === 59 || byte === 32 || byte === 9) this.inExtension = true;
      else {
        this.protocolError("BadChunk");
        return buffer.length;
      }
    }
    return offset;
  }

  /** Skip trailer lines; the response ends at the first empty line. */
  private trailerLine(buffer: Buffer, offset: number): number {
    for (; offset < buffer.length; offset++) {
      const byte = buffer[offset]!;
      if (byte === 10) {
        if (this.lineLength === 0) {
          this.finish();
          return offset + 1;
        }
        this.lineLength = 0;
      } else if (byte !== 13 && ++this.lineLength > 8192) {
        this.protocolError("TrailerTooLarge");
        return buffer.length;
      }
    }
    return offset;
  }

  private protocolError(error: string): void {
    this.fail(error);
    this.drop();
  }

  private parseHead(text: string): void {
    const lines = text.split("\r\n");
    const status = Number(lines[0]!.split(" ")[1]);
    let length = -1;
    let chunked = false;
    for (let index = 1; index < lines.length; index++) {
      const header = lines[index]!;
      const colon = header.indexOf(":");
      if (colon === -1) continue;
      const name = header.slice(0, colon).trim().toLowerCase();
      const value = header.slice(colon + 1).trim().toLowerCase();
      if (name === "content-length") length = Number(value);
      else if (name === "transfer-encoding") chunked = value.includes("chunked");
      else if (name === "connection") this.closeAfter = value.includes("close");
    }
    this.response!.status = Number.isInteger(status) ? status : 0;
    if (chunked) this.state = State.ChunkSize;
    else if (length >= 0 && Number.isSafeInteger(length)) {
      this.remaining = length;
      this.state = State.Length;
    } else {
      this.state = State.Close;
      this.closeAfter = true;
    }
  }

  private feed(buffer: Buffer): void {
    const response = this.response;
    if (!response) {
      // Bytes with no request in flight: the connection is out of sync.
      this.drop();
      return;
    }
    if (response.firstByte === 0n) response.firstByte = now();
    let offset = 0;
    while (this.response === response && offset < buffer.length) {
      switch (this.state) {
        case State.Head: {
          const previous = this.head ? this.head.length : 0;
          this.head = this.head ? Buffer.concat([this.head, buffer.subarray(offset)]) : buffer.subarray(offset);
          const index = this.head.indexOf(CRLFCRLF);
          if (index === -1) {
            if (this.head.length > 65536) this.protocolError("HeadTooLarge");
            offset = buffer.length;
            break;
          }
          offset += index + 4 - previous;
          this.parseHead(this.head.toString("latin1", 0, index));
          this.head = null;
          if ((this.state as number) === State.ChunkSize) this.startChunkSize();
          if ((this.state as number) === State.Length && this.remaining === 0) this.finish();
          break;
        }
        case State.Length:
        case State.ChunkData: {
          const size = Math.min(this.remaining, buffer.length - offset);
          this.take(buffer, offset, offset + size);
          this.remaining -= size;
          offset += size;
          if (this.remaining === 0) {
            if (this.state === State.Length) this.finish();
            else {
              this.state = State.ChunkCrlf;
              this.remaining = 2;
            }
          }
          break;
        }
        case State.Close:
          this.take(buffer, offset, buffer.length);
          offset = buffer.length;
          break;
        case State.ChunkCrlf: {
          const size = Math.min(this.remaining, buffer.length - offset);
          offset += size;
          this.remaining -= size;
          if (this.remaining === 0) this.startChunkSize();
          break;
        }
        case State.ChunkSize:
          offset = this.chunkSizeLine(buffer, offset);
          break;
        case State.Trailer:
          offset = this.trailerLine(buffer, offset);
          break;
        default:
          offset = buffer.length;
      }
    }
    // Bytes after a complete response (nothing is pipelined): the connection is out of sync.
    if (offset < buffer.length && this.response !== response) this.drop();
  }
}
