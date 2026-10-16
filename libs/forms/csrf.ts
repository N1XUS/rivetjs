// CSRF token mode (`@rivetjs/forms/csrf`, server only) for deployments where proxies strip Origin:
// signed double submit. An HttpOnly SameSite=Lax cookie holds a random nonce; the form's hidden
// `_csrf` field holds HMAC(secret, nonce | session). The action recomputes and compares.
//
//   load:    ({ csrf: csrfToken(event, options) })      page: <input type="hidden" name="_csrf" value={data.csrf} />
//   action:  action(def, fn, { csrf: verifyCsrf(options) })
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestEvent } from "@rivetjs/router";

/** Options of the signed CSRF token helpers. */
export interface CsrfOptions {
  /** HMAC key (at least 32 bytes of entropy; keep it out of the client). */
  secret: string;
  /** Binds tokens to the signed-in session (default: none, the nonce alone). */
  session?: (event: RequestEvent) => string | undefined;
  /** Cookie name (default `__rivet_csrf`; `__Host-` prefixed in production). */
  cookie?: string;
}
const cookieName = (event: RequestEvent, options: CsrfOptions) => options.cookie ?? (event.dev || event.url.protocol !== "https:" ? "__rivet_csrf" : "__Host-rivet_csrf");
const sign = (options: CsrfOptions, nonce: string, session: string) => createHmac("sha256", options.secret).update(nonce + "|" + session).digest("base64url");

/** The token for this request's forms (sets the nonce cookie when missing). */
export function csrfToken(event: RequestEvent, options: CsrfOptions): string {
  if (options.secret.length < 32) throw new RangeError("csrfToken: secret must be at least 32 characters");
  const name = cookieName(event, options);
  let nonce = event.cookies.get(name);
  if (!nonce || !/^[\w-]{22,64}$/.test(nonce)) {
    nonce = randomBytes(18).toString("base64url");
    event.cookies.set(name, nonce, { path: "/", httpOnly: true, sameSite: "lax", secure: event.url.protocol === "https:" });
  }
  return sign(options, nonce, options.session?.(event) ?? "");
}

/** `action(def, fn, { csrf: verifyCsrf(options) })`: false (→ 403) unless `_csrf` matches the cookie. */
export function verifyCsrf(options: CsrfOptions): (event: RequestEvent, data: FormData) => boolean {
  return (event, data) => {
    const nonce = event.cookies.get(cookieName(event, options));
    const token = data.get("_csrf");
    if (!nonce || typeof token !== "string" || !token) return false;
    const expected = Buffer.from(sign(options, nonce, options.session?.(event) ?? ""));
    const actual = Buffer.from(token);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
}
