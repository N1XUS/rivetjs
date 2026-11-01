// `@rivetjs/router/env`: typed, validated server environment (`defineEnv`). Server-only: the router plugin fails a
// browser build that imports this module (same guard as `@rivetjs/router/server-only`). No `import.meta.env`: reads
// `process.env` (or the source given) once, when the defining module first runs, so a bad deployment fails at start.
import type { StandardSchemaV1 } from "./shared/standard-schema.ts";

export type { StandardSchemaV1 } from "./shared/standard-schema.ts";

/** An environment source: `process.env` by default, any string record otherwise (tests, Workers bindings). */
export type EnvSource = Readonly<Record<string, string | undefined>>;
/** A Standard Schema per variable, or one Standard Schema for the whole environment (`z.object({ … })`). */
export type EnvSchema = StandardSchemaV1 | Readonly<Record<string, StandardSchemaV1>>;
/** The typed result of `defineEnv(schema)`: read-only. */
export type EnvOf<S extends EnvSchema> = S extends StandardSchemaV1
  ? Readonly<StandardSchemaV1.InferOutput<S>>
  : { readonly [K in keyof S]: S[K] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<S[K]> : never };

/** One invalid variable: its name and every message the schema reported for it (values are never included). */
export interface EnvIssue {
  readonly key: string;
  readonly messages: readonly string[];
}

/** Thrown by `defineEnv` when variables are missing or invalid: `issues` lists every bad key, in schema order. */
export class EnvError extends Error {
  readonly issues: readonly EnvIssue[];
  constructor(issues: readonly EnvIssue[]) {
    super("[rivet:env] invalid environment variables:\n" + issues.map((issue) => `  ${issue.key}: ${issue.messages.join("; ")}`).join("\n"));
    this.name = "EnvError";
    this.issues = issues;
  }
}

/** A schema message with the variable's raw value cut out: libraries quote what they received (`received "…"`). */
const redact = (message: string, value: string | undefined) => (value ? message.split(value).join("[redacted]") : message);

/** Validate one value; failures go to `bad` under `key`, or under each issue's first path segment (whole-source schema). */
function check(schema: StandardSchemaV1, value: unknown, key: string | null, env: EnvSource, bad: Map<string, string[]>): StandardSchemaV1.Result<unknown> {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) throw new TypeError(`[rivet:env] defineEnv needs synchronous schemas (${key ?? "schema"} is async)`);
  for (const issue of result.issues ?? []) {
    const first = issue.path?.[0];
    const name = key ?? String((first !== null && typeof first === "object" ? first.key : first) ?? "(env)");
    const message = redact(issue.message, env[name]);
    bad.get(name)?.push(message) ?? bad.set(name, [message]);
  }
  return result;
}

/**
 * Validate the environment against `schema` and return it typed and frozen. `schema`: one Standard Schema per
 * variable (`{ PORT: v.pipe(v.string(), v.transform(Number)) }`: the result has exactly these keys) or one schema for
 * the whole source (`z.object({ … })`: the result is its output). `source` defaults to `process.env` (`{}` where the
 * platform has none). Any missing / invalid variable throws one `EnvError` listing every bad key with its messages;
 * values never appear in it. Synchronous schemas only. Call it at the top level of a server module (`env.server.ts`).
 */
export function defineEnv<S extends EnvSchema>(schema: S, source?: EnvSource): EnvOf<S> {
  const env: EnvSource = source ?? (globalThis as { process?: { env?: EnvSource } }).process?.env ?? {};
  const bad = new Map<string, string[]>();
  let out: Record<string, unknown> = {};
  if ("~standard" in schema) {
    const result = check(schema as StandardSchemaV1, { ...env }, null, env, bad);
    if (!result.issues) {
      if (result.value === null || typeof result.value !== "object") throw new TypeError("[rivet:env] defineEnv: schema output must be an object");
      out = result.value as Record<string, unknown>;
    }
  } else
    for (const key of Object.keys(schema)) {
      const result = check((schema as Record<string, StandardSchemaV1>)[key]!, env[key], key, env, bad);
      if (!result.issues) out[key] = result.value;
    }
  if (bad.size) throw new EnvError([...bad].map(([key, messages]) => ({ key, messages })));
  return Object.freeze(out) as EnvOf<S>;
}
