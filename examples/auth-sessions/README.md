# auth-sessions

Accounts with database sessions on Node's built-in `node:sqlite`: sign up, sign in, sign out, a sessions list with "sign out other sessions", password change, password reset links and login rate limits. It follows the Lucia v3 session recipe (Lucia itself is now a learning resource, so the code is all here). Every form is a real POST, so the whole flow works with JavaScript off. With JavaScript, `@rivetjs/forms` validates as you type and shows server errors without a reload.

Reference code, not a drop-in auth library: read "Not production-hardened" below before you copy it.

## Run

From the repository root, install dependencies once with `npm ci`, then:

```sh
cd examples/auth-sessions
cp .env.example .env     # optional: DATABASE_PATH, PORT, APP_ORIGIN, rate limits
npm run build
npm run seed             # optional: demo@example.com / rivet-dev-password
npm start                # http://127.0.0.1:3000 (the first start creates data/auth.db)
```

Dev: `npm run dev`. Check types and Rivet diagnostics: `npm run check`. Reset: delete `data/`. Password reset mails are printed to the server console (`[mail] …`).

The `__Host-session` cookie is `Secure`. Chromium and Firefox accept it on `http://127.0.0.1` and `http://localhost`, because loopback counts as a secure context. Safari does not: for local development there, set `SESSION_COOKIE_INSECURE=1` to use a plain `session` cookie without `Secure`. The server refuses that setting when `NODE_ENV=production`.

## What it shows

- `migrations/0001_init.sql`: `users`, `sessions` (SHA-256 of the token, never the token), `password_resets` (hashed, single use).
- `src/server/sessions.server.ts`: 256-bit random tokens, sliding expiry (30 days, extended once less than 15 are left), rotation, sessions list, cookie flags.
- `src/server/password.server.ts`: scrypt from `node:crypto` (N=2^14, r=8, p=5, OWASP), 16-byte per-user salt, `timingSafeEqual`, parameters stored with the hash (`needsRehash`).
- `src/server/rate-limit.server.ts`: failed sign-ins per client address (20 per 15 minutes) and per account (5). Reset mails are limited to 3 per email per 15 minutes. Sign-up attempts and invalid reset-confirm tokens are limited per client address (10 each), so neither form becomes a way to buy scrypt runs.
- `src/server/auth.server.ts`: the action bodies for sign in, sign up, password change, reset request and confirmation.
- `src/routes/_layout.tsx`: root `guard(readSession)` puts the user on `event.locals.auth` for every page, data request and action. It also sets frame and referrer headers.
- `src/routes/account.tsx`: a `guard` that sends signed-out visitors to `/signin?next=…`, the sessions list (revoke one, sign out others), password change and the sign-out action.
- `src/routes/signin.tsx` / `signup.tsx`: `safeRedirect` for `?next=`; `next` survives a failed POST through the forms echo.
- `src/routes/reset/*`: reset request (the same answer for every email) and confirmation.
- `src/forms/auth.ts`: shared Zod definitions. Fields named `password` are never echoed back; `current` is excluded explicitly.

## Security checklist (OWASP Session Management and Authentication cheat sheets)

- [x] Session ID: 256 bits from `crypto.randomBytes`. The database stores only its SHA-256, so a database leak exposes no usable token.
- [x] Cookie: `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, `Max-Age` equal to the session's lifetime.
- [x] Server-side expiry: 30 days, sliding. An expired session is deleted and its cookie cleared, and expired rows are swept hourly.
- [x] Renewal on privilege change: sign-in, sign-up, password change and password reset end the old session and issue a new token. A sign-in POST while you hold a session also rotates it, so a session cookie planted by someone else never survives it.
- [x] Logout: a POST, never a GET. It deletes the row and the cookie, and a replayed token is refused.
- [x] Other sessions: listed with device and address; you can revoke one (yours only) or all others. A password change or reset ends every other session.
- [x] Passwords: scrypt with a per-user salt, constant-time compare, 10–128 characters (NIST 800-63B: length over composition rules; the upper bound caps hashing work), never echoed into HTML.
- [x] No account enumeration through sign-in or reset: one message for an unknown email and a wrong password, and an unknown email still pays for a scrypt run (dummy hash). The reset form gives the same answer for every email.
- [x] Brute force: per-address and per-account limits, checked before any hashing. Over the limit: 429 with `Retry-After`.
- [x] Hashing work: sign-up is limited per address, and reset confirmation checks the token before hashing (invalid tokens count against the address), so unauthenticated requests cannot queue scrypt runs at will.
- [x] Reset tokens: 256 bits, hashed, single use (consumed by one `UPDATE … RETURNING`), 30-minute expiry, a new request voids the old token. `Referrer-Policy: same-origin` and `Cache-Control: no-store` on the page.
- [x] CSRF: the router refuses cross-site unsafe requests (`Origin` / `Sec-Fetch-Site`). In production, `@rivetjs/forms` actions also refuse POSTs that carry neither header. No route sets `csrf = false`.
- [x] Open redirects: `?next=` passes through `safeRedirect` (same-origin paths only) on both the page and the action.
- [x] Caching and framing: signed-in responses send `Cache-Control: no-store`. Every page sends `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
- [ ] Account enumeration on sign-up: "An account with this email already exists" is a usability trade-off. The strict alternative is to always answer "check your inbox" and mail the existing owner.
- [ ] Not production-hardened: there is no email verification, MFA / passkeys, breached-password check (HIBP k-anonymity), CAPTCHA after repeated failures, audit log or re-authentication timeout for sensitive actions.
- [ ] The rate limiter keeps its state in process memory: one process only, and it is lost on restart. With several processes, use a shared store (Redis, the database). Behind a proxy, configure the node adapter's `trustProxy`; otherwise every client shares the proxy's address and its limit. The adapter trusts no `X-Forwarded-For` by default.
- [ ] Mail: `src/server/mail.server.ts` logs to the console. Replace it with a real provider. `APP_ORIGIN` is required in production (`serve.ts` pins it as the server `origin`, so CSRF checks and reset links never use the request's `Host`); development falls back to the request URL.

## Rulings

- Database: `node:sqlite` instead of PGlite/Postgres, because PGlite is not installed in the workspace. The SQL is portable (`RETURNING`, `ON DELETE CASCADE`), and the migrations and seed use the `sqlite-local` layout.
- Optional GitHub OAuth (`arctic`, PKCE and a state cookie) is not built, because `arctic` is not installed. Follow-up: an `oauth_accounts` table, `/signin/github` (state and verifier cookies) and a GET callback (no `csrf = false`), tested against an in-process fake provider.
- Cookie in development: always the production `__Host-session` cookie (loopback is a secure context in Chromium and Firefox). The opt-in insecure cookie exists for Safari only.
- No client-side router (`clientRouter` off): links are document loads. Pages with forms still resume, and an enhanced submit's redirect is a client navigation. The root layout's loader reads the URL, so the router reruns it and the header follows a sign-in.

## Test

From the repository root:

```sh
npx playwright install chromium
npx vitest run --project examples --maxWorkers=1 examples/auth-sessions
```

`tests/units.test.ts` covers hashing, tokens, sliding expiry, reset tokens and the limiter on an in-memory database. `tests/app.test.ts` builds the example and runs the production server on 127.0.0.1:4475 with a fresh SQLite file. Over fetch, it checks:

- cookie flags and hashed storage
- validation, and that passwords are never echoed
- one error message for every failed sign-in, and rotation
- `?next=` open-redirect cases
- revoking a session (only your own), signing out other sessions, signing out, and that a GET never signs out
- sliding renewal and expiry
- password change
- reset: same answer for every email, single use, expiry, mail limit
- per-account and per-address rate limits
- CSRF refusals

In Chromium, it runs sign-up and sign-in with JavaScript on (client validation, enhanced errors, two browser contexts as two devices, "sign out other sessions") and the whole JS-off flow including a reset. The sign-in page loads no script file before input. All JS for its first interaction (the loader's preload list) must stay under 100 KB brotli (measured 2026-11-01: 89.5 KB: runtime 28 KB, router app 10 KB, forms + Zod 12.5 KB, ui form parts).

Versions verified 2026-11-01: Node 26.5 and 24.18 (`node:sqlite`; Node >= 24 required), Vite 8.3.2, Tailwind CSS 4.3.3, Zod 3.25.76.
