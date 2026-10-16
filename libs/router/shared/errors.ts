// Control-flow results for guards, loaders and actions: thrown or returned, never rendered as data.
import { unsafeTarget } from "./redirect.ts";

/** A redirect, denial or HTTP failure ending the guard/loader chain. */
export class HttpError extends Error {
  declare readonly status: number;
  /** Redirect target for 3xx. */
  declare readonly location: string | undefined;
  /** Safe to show to users (4xx messages); 5xx details stay server-side. */
  declare readonly expose: boolean;
  constructor(status: number, message: string, location?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.location = location;
    this.expose = status < 500;
  }
}

/** Options of `redirect()`. */
export interface RedirectOptions {
  status?: 301 | 302 | 303 | 307 | 308;
  /** Allow an absolute `http(s):` URL on another origin (payment providers, SSO). */
  external?: boolean;
}
type RedirectStatus = NonNullable<RedirectOptions["status"]>;
/**
 * Redirect (default 302 Found, 303 See Other from actions; 307/308 keep the method). Same-origin
 * only: relative targets, or absolute URLs on the request's origin; `{ external: true }` allows
 * other origins. Protocol-relative (`//x`), backslash and control-character targets throw.
 */
export function redirect(location: string, status?: RedirectStatus | RedirectOptions, options?: RedirectOptions): HttpError {
  const opts = typeof status === "object" ? status : options;
  const code = typeof status === "number" ? status : opts?.status;
  const external = opts?.external === true;
  const unsafe = unsafeTarget(location);
  if (unsafe) throw new Error(`redirect(): unsafe target ${JSON.stringify(location)} (${unsafe})`);
  if (external && !/^https?:\/\//i.test(location)) throw new Error(`redirect(): external target must be an absolute http(s) URL, got ${JSON.stringify(location)}`);
  const error = new HttpError(code ?? 302, "Redirect", location);
  // Actions answer a defaulted redirect with 303 (POST → GET); an explicit status is kept.
  if (code === undefined) Object.defineProperty(error, "defaultStatus", { value: true });
  // The handler checks absolute targets against the request origin unless external.
  if (external) Object.defineProperty(error, "external", { value: true });
  return error;
}
/** Refuse access (default 403). */
export function deny(status: 401 | 403 = 403, message = status === 401 ? "Unauthorized" : "Forbidden"): HttpError {
  return new HttpError(status, message);
}
/** The resource does not exist; renders the nearest `_404`. */
export function notFound(message = "Not found"): HttpError {
  return new HttpError(404, message);
}
/** Fail with an explicit status; renders the nearest `_error`. */
export function error(status: number, message: string): HttpError {
  if (!Number.isInteger(status) || status < 400 || status > 599) throw new RangeError("error() status must be 4xx or 5xx");
  return new HttpError(status, message);
}
/** Whether a value is an `HttpError` thrown by `error()` / `notFound()`. */
export const isHttpError = (value: unknown): value is HttpError => value instanceof HttpError;
