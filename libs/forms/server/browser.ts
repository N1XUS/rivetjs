// Browser resolution of `@rivetjs/forms/server` and `@rivetjs/forms/csrf`: server-only code (body
// parsing, secrets) must never join a client graph.
throw new Error("@rivetjs/forms/server and @rivetjs/forms/csrf are server-only: import them from `*.server.ts` modules");
