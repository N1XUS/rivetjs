// Request hardening the handler applies to state-changing requests: cross-site request rejection
// (Origin / Fetch Metadata) and a request body size limit.
import { HttpError } from "../shared/errors.ts";

/** Content types a cross-site HTML form (or a CORS "simple" request) can send. */
const FORM_TYPES = new Set(["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"]);
const MiB = 1024 * 1024;

/**
 * Reject cross-site unsafe requests: `Origin` must equal the app origin; without it `Sec-Fetch-Site`
 * must be `same-origin`; with neither, form content types are rejected outside dev (browsers send at
 * least one header; non-browser JSON clients send none; dev keeps `curl -d` working).
 */
export function crossSite(request: Request, origin: string, dev: boolean): boolean {
  const header = request.headers.get("origin");
  if (header !== null) return header !== origin;
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site !== "same-origin";
  return !dev && FORM_TYPES.has(mediaType(request));
}

const mediaType = (request: Request): string => (request.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();

/** Request body limit: bytes for every body, or per kind (`multipart` uploads usually get more). */
export type BodyLimit = number | { readonly default?: number; readonly multipart?: number };
const TOO_LARGE = "Payload too large";

/**
 * The request with its body limited to `limit` bytes: 413 at once for a larger `Content-Length`,
 * else the body stream errors (and `state.exceeded` is set) once it passes the limit.
 */
export function limitBody(request: Request, limit: BodyLimit | undefined, state: { exceeded: boolean }): Request {
  const max =
    typeof limit === "number" ? limit : mediaType(request) === "multipart/form-data" ? (limit?.multipart ?? 10 * MiB) : (limit?.default ?? MiB);
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > max) {
    state.exceeded = true;
    throw new HttpError(413, TOO_LARGE);
  }
  if (!request.body || max === Infinity) return request;
  let size = 0;
  const body = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.byteLength;
        if (size <= max) return controller.enqueue(chunk);
        state.exceeded = true;
        controller.error(new HttpError(413, TOO_LARGE));
      },
    }),
  );
  return new Request(request, { body, duplex: "half" } as RequestInit);
}
