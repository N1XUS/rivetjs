# examples/auth-sessions

- Server code only in `src/server/*.server.ts`; pages import them inside server-export wrappers (`guard` / `load` / `actions` / `headers`), which the compiler strips from browser builds.
- Session model: cookie = random 32-byte token (base64url, 43 chars), `sessions.token_hash` = SHA-256 hex. Only `validateSession` reads a token. `id` (integer) is the public handle the revoke form posts, and always matched with `user_id`.
- Root `_layout.tsx` `guard(readSession)` sets `event.locals.auth` (`Auth | null`, read with `authOf(event)`), renews the cookie when the sliding expiry moved, clears unknown / expired cookies, sends `no-store` for signed-in responses and sweeps expired rows hourly. The layout loader reads `event.url` (on purpose, see README "Rulings"): an enhanced submit's redirect is a client navigation that would otherwise keep the signed-out header.
- Rotation (`startSession`) on sign-in, sign-up, password change and reset. The sign-in / sign-up guards redirect signed-in visitors on GET only, so a POST always rotates.
- Router actions clear the query for the failed-action render (`handler.ts` `url.search = ""`): values the page needs after a failed POST (`next`, the reset `token`) come back in the forms echo, not from `url`.
- `APP_ORIGIN`: required in production (`resetOrigin` throws without it; `serve.ts` passes it as `start({ origin })`), so reset links and CSRF never trust `Host`.
- Do not set `Referrer-Policy: no-referrer` on a page with a POST form: Chromium then sends `Origin: null` and the router's CSRF check returns 403. The layout uses `same-origin`.
- In-process state on `globalThis` (`Symbol.for("rivet.example.auth-sessions.outbox" | ".limits")`): the mail outbox and limiter failures. The tests run the server in-process and read or clear them. `RATE_LIMIT_IP` / `RATE_LIMIT_ACCOUNT` are read on every call.
- Tests: `tests/units.test.ts` (`:memory:`), `tests/app.test.ts` (production build into `dist/`, port 4475, temp DB file, `MAIL_LOG=0`, one Chromium at a time). The JS budget is 100 KB brotli over the sign-in page's `data-fo` list (`rivetExample.jsBudgetKB`).
- Not built: GitHub OAuth (`arctic` not installed), PGlite (not installed). See README.
