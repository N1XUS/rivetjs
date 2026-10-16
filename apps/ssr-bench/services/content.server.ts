// Shared data client of every Node lane (`server.ts` and the router lanes): one unary gRPC call per page,
// `rivet.bench.Content/GetPage` (proto/content.proto), over a lean `node:http2` client instead of grpc-js.
// Same class of client as the other stacks' official lean ones (Grpc.Net.Client for Razor): one persistent
// HTTP/2 session, a hand-framed request (5-byte gRPC prefix + protobuf), the response decoded once by the static
// decoder in the stream's `end` handler (outside any call-state object chain, so in-flight pages are not kept
// alive by old call objects). Wire bytes, request schema and validation are the same as with grpc-js.
import http2 from "node:http2";
import { decodePage, type Page } from "./page-decoder.ts";

/** rivet.bench.PageRequest. */
export interface PageRequest {
  rows: number;
  token: string;
  article: boolean;
  delayMs: number;
  /** Text variant: 0 integers, 1 escaping, 2 text grid (rows carry text values, see loadgen/validate.ts fieldText). */
  strings?: number;
}

/** A failed call: `code` is the gRPC status (`grpc-status` trailer, or 2 UNKNOWN / 4 DEADLINE_EXCEEDED / 8 RESOURCE_EXHAUSTED / 13 INTERNAL / 14 UNAVAILABLE locally). */
export class GrpcError extends Error {
  readonly code: number;
  readonly details: string;
  constructor(code: number, details: string) {
    super(`${code} ${details}`);
    this.name = "GrpcError";
    this.code = code;
    this.details = details;
  }
}

/** Text variant of a `/page` query: `strings=1` escaping, `strings=2` text grid, anything else 0 (integers). */
export function textProfile(param: string | null): number {
  return param === "1" ? 1 : param === "2" ? 2 : 0;
}

const DEADLINE_MS = 15000;
const MAX_MESSAGE = 16 * 1024 * 1024;
// Session + stream receive window: lets a large response (text grid ≈ 450 KB, 5000 rows) arrive without
// WINDOW_UPDATE round trips (Grpc.Net.Client scales its window dynamically to the same end).
const WINDOW = 16 * 1024 * 1024;
const HEADERS = {
  ":method": "POST",
  ":path": "/rivet.bench.Content/GetPage",
  "content-type": "application/grpc",
  te: "trailers",
  "grpc-timeout": `${DEADLINE_MS}m`,
};

function varint(out: number[], value: number): void {
  // int32 fields: negative values are sign-extended to ten bytes (proto3 encoding).
  if (value < 0) {
    let low = value >>> 0;
    for (let i = 0; i < 4; i++, low >>>= 7) out.push((low & 0x7f) | 0x80);
    out.push((low & 0x0f) | 0x70 | 0x80, 0xff, 0xff, 0xff, 0xff, 0x01);
    return;
  }
  while (value >= 0x80) {
    out.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  out.push(value);
}

/** One length-prefixed gRPC message carrying a serialized PageRequest (proto3: default fields omitted). Exported for tests. */
export function encodePageRequest(request: PageRequest): Buffer {
  const head: number[] = [];
  if (request.rows) (head.push(0x08), varint(head, request.rows | 0));
  const token = request.token ? Buffer.from(request.token, "utf8") : undefined;
  if (token) (head.push(0x12), varint(head, token.length));
  const tail: number[] = [];
  if (request.article) tail.push(0x18, 1);
  if (request.delayMs) (tail.push(0x20), varint(tail, request.delayMs | 0));
  if (request.strings) (tail.push(0x28), varint(tail, request.strings | 0));
  const length = head.length + (token?.length ?? 0) + tail.length;
  const frame = Buffer.allocUnsafe(5 + length);
  frame[0] = 0;
  frame.writeUInt32BE(length, 1);
  let at = 5;
  for (const byte of head) frame[at++] = byte;
  if (token) at += token.copy(frame, at);
  for (const byte of tail) frame[at++] = byte;
  return frame;
}

/** Opens one reusable HTTP/2 gRPC channel for a frontend process (`address` = `host:port`, plaintext h2c). */
export function contentServer(address: string) {
  let session: http2.ClientHttp2Session | undefined;
  let closed = false;
  const grpcSession = (): http2.ClientHttp2Session => {
    if (session && !session.closed && !session.destroyed) return session;
    const s = http2.connect(`http://${address}`, { settings: { initialWindowSize: WINDOW } });
    s.once("connect", () => s.setLocalWindowSize(WINDOW));
    // Session errors also destroy its streams, which reject their own calls; the next call reconnects.
    const drop = () => {
      if (session === s) session = undefined;
    };
    s.on("error", drop);
    s.once("goaway", drop);
    s.once("close", drop);
    s.unref();
    return (session = s);
  };
  return {
    /** Fetches one fixture through gRPC, cancelling it when its owning HTTP request is aborted. */
    getPage(request: PageRequest, { signal }: { signal?: AbortSignal } = {}): Promise<Page> {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);
        if (closed) return reject(new GrpcError(14, "channel closed"));
        const stream = grpcSession().request(HEADERS, signal ? { signal } : undefined);
        const chunks: Buffer[] = [];
        let length = 0;
        let status: string | undefined;
        let message: string | undefined;
        let failure: Error | undefined;
        const fail = (error: Error) => {
          failure ??= error;
          stream.close(http2.constants.NGHTTP2_CANCEL);
        };
        stream.setTimeout(DEADLINE_MS, () => fail(new GrpcError(4, "deadline exceeded")));
        stream.on("response", function grpcResponse(headers) {
          if (headers[":status"] !== 200) fail(new GrpcError(14, `HTTP status ${headers[":status"]}`));
          // Trailers-only response (errors): the status arrives with the headers.
          if (headers["grpc-status"] !== undefined) ((status = String(headers["grpc-status"])), (message = headers["grpc-message"] as string | undefined));
        });
        stream.on("data", function grpcData(chunk: Buffer) {
          chunks.push(chunk);
          if ((length += chunk.length) > MAX_MESSAGE + 5) fail(new GrpcError(8, "response exceeds 16 MiB"));
        });
        stream.on("trailers", function grpcTrailers(trailers) {
          status = String(trailers["grpc-status"]);
          message = trailers["grpc-message"] as string | undefined;
        });
        stream.on("error", (error) => {
          if (!failure) failure = signal?.aborted ? signal.reason : error;
        });
        stream.on("close", function grpcEnd() {
          if (failure) return reject(failure);
          if (status !== "0")
            return reject(new GrpcError(status === undefined ? 13 : Number(status), message ? decodeURIComponent(message) : "no grpc-status"));
          const body = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks, length);
          if (length < 5 || body[0] !== 0 || body.readUInt32BE(1) !== length - 5) return reject(new GrpcError(13, "malformed or compressed unary response"));
          try {
            resolve(decodePage(body.subarray(5)));
          } catch (error) {
            reject(new GrpcError(13, `decode: ${(error as Error).message}`));
          }
        });
        stream.end(encodePageRequest(request));
      });
    },
    /** Closes the process-owned session on shutdown. */
    close() {
      closed = true;
      session?.close();
      session = undefined;
    },
  };
}
